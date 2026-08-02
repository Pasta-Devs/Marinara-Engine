import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const TRANSPARENT_GIF_BASE64 = "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const WHATS_NEW_SEEN_VERSION_KEY = "marinara:whats-new:seen-version";
const WHATS_NEW_E2E_BYPASS_KEY = "marinara:e2e:show-whats-new";
const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function collectUnexpectedErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/favicon|ResizeObserver/i.test(text)) return;
    errors.push(text);
  });
  return errors;
}

async function prepareFreshClient(page: Page) {
  await page.addInitScript((appVersion) => {
    if (sessionStorage.getItem("marinara:e2e:show-whats-new") !== "true") {
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    }
    if (localStorage.getItem("marinara-engine-ui")) return;
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: {
          hasCompletedOnboarding: true,
          rightPanelOpen: false,
          sidebarOpen: false,
        },
        version: 65,
      }),
    );
  }, APP_VERSION);
}

async function setAppAccentColor(page: Page, color: string) {
  await page.evaluate(async (nextColor) => {
    const { useUIStore } = (await import("/src/stores/ui.store.ts")) as {
      useUIStore: {
        getState: () => {
          setAppAccentColor: (value: string) => void;
        };
      };
    };
    useUIStore.getState().setAppAccentColor(nextColor);
  }, color);
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--marinara-app-accent-static").trim(),
      ),
    )
    .toBe(color);
}

async function readCssVariableColor(page: Page, variableName: string) {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, variableName);
}

async function bestEffortDelete(request: APIRequestContext, url: string) {
  await request.delete(url, { timeout: 5_000 }).catch(() => undefined);
}

async function getChatCharacterIds(request: APIRequestContext, chatId: string): Promise<string[]> {
  const response = await request.get(`/api/chats/${chatId}`);
  const stored = (await response.json()) as { characterIds?: string[] | string };
  return typeof stored.characterIds === "string" ? JSON.parse(stored.characterIds) : (stored.characterIds ?? []);
}

async function dragChatResource(page: Page, source: Locator, target: Locator) {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  try {
    await source.dispatchEvent("dragstart", { dataTransfer });
    await target.dispatchEvent("dragenter", { dataTransfer });
    await target.dispatchEvent("dragover", { dataTransfer });
    await target.dispatchEvent("drop", { dataTransfer });
    await source.dispatchEvent("dragend", { dataTransfer });
  } finally {
    await dataTransfer.dispose();
  }
}

async function expectHomeContentFits(page: Page) {
  const home = page.locator('[data-component="ChatArea.EmptyState"]');
  await expect
    .poll(async () => {
      return home.evaluate((homeElement) => {
        const contentElement = homeElement.querySelector<HTMLElement>('[data-component="ChatArea.HomeContent"]');
        if (!contentElement) return false;
        const homeRect = homeElement.getBoundingClientRect();
        const contentRect = contentElement.getBoundingClientRect();
        return contentRect.top >= homeRect.top - 1 && contentRect.bottom <= homeRect.bottom + 1;
      });
    })
    .toBe(true);
}

async function updateLiveReasoningState(
  page: Page,
  chatId: string,
  action: "start" | "append-thinking" | "append-content" | "stop",
  value = "",
) {
  await page.evaluate(
    async ({ activeChatId, nextAction, nextValue }) => {
      const storePath = "/src/stores/chat.store.ts";
      const { useChatStore } = (await import(/* @vite-ignore */ storePath)) as {
        useChatStore: {
          getState: () => {
            appendStreamBuffer: (text: string, chatId?: string) => void;
            appendThinkingBuffer: (text: string, chatId?: string) => void;
            clearStreamBuffer: (chatId?: string) => void;
            clearThinkingBuffer: (chatId?: string) => void;
            setStreaming: (streaming: boolean, chatId?: string) => void;
          };
        };
      };
      const chat = useChatStore.getState();
      if (nextAction === "start") {
        chat.clearStreamBuffer(activeChatId);
        chat.clearThinkingBuffer(activeChatId);
        chat.setStreaming(true, activeChatId);
      } else if (nextAction === "append-thinking") {
        chat.appendThinkingBuffer(nextValue, activeChatId);
      } else if (nextAction === "append-content") {
        chat.appendStreamBuffer(nextValue, activeChatId);
      } else {
        chat.setStreaming(false, activeChatId);
        chat.clearStreamBuffer(activeChatId);
        chat.clearThinkingBuffer(activeChatId);
      }
    },
    { activeChatId: chatId, nextAction: action, nextValue: value },
  );
}

test.beforeEach(async ({ page }) => {
  const resetUiSettings = await page.request.put("/api/app-settings/ui", { data: { value: "" } });
  expect(resetUiSettings.ok()).toBeTruthy();
  await prepareFreshClient(page);
});

test("What's New opens once for each Marinara Engine version", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    ({ bypassKey, seenKey }) => {
      sessionStorage.setItem(bypassKey, "true");
      localStorage.removeItem(seenKey);
    },
    { bypassKey: WHATS_NEW_E2E_BYPASS_KEY, seenKey: WHATS_NEW_SEEN_VERSION_KEY },
  );
  await page.reload();

  const announcement = page.getByRole("dialog", { name: "What's New?" });
  await expect(announcement).toBeVisible();
  await expect(announcement.getByText(`Version ${APP_VERSION}`, { exact: true })).toBeVisible();
  await expect(announcement.getByRole("heading", { name: "The extensions are back!" })).toBeVisible();
  await expect(announcement.getByText(/new Personas icon/)).toBeVisible();
  await expect(announcement.getByText(/edit presets, characters, personas, and lorebooks/)).toBeVisible();
  await expect(announcement.getByText(/three new Agents/)).toBeVisible();
  await expect(announcement.getByText(/many bug fixes and QoL updates/)).toBeVisible();
  await expect(announcement.locator('[data-release-story="2.4.0"] img')).toHaveCount(12);
  await expect(announcement.getByAltText("The new Personas icon in Marinara Engine")).toHaveAttribute(
    "src",
    "https://i.imgur.com/K4Z9rSA.png",
  );
  const announcementScrollArea = announcement.locator('[data-component="WhatsNewModal"]').locator("..");
  await expect.poll(() => announcementScrollArea.evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");
  await expect
    .poll(() => announcementScrollArea.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);
  await expect(announcement.getByText("Marinara Engine has been updated.", { exact: true })).toHaveCount(0);
  await expect(announcement.getByText("Tactical Combat Mode in Games")).toHaveCount(0);
  await expect(announcement.getByRole("link", { name: "View release" })).toHaveAttribute(
    "href",
    `https://github.com/Pasta-Devs/Marinara-Engine/releases/tag/v${APP_VERSION}`,
  );

  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), WHATS_NEW_SEEN_VERSION_KEY))
    .toBe(APP_VERSION);
  await announcement.getByRole("button", { name: "Got it" }).click();
  await expect(announcement).toBeHidden();

  await page.reload();
  await expect(announcement).toBeHidden();

  await page.evaluate(({ key, previousVersion }) => localStorage.setItem(key, previousVersion), {
    key: WHATS_NEW_SEEN_VERSION_KEY,
    previousVersion: "2.2.1",
  });
  await page.reload();
  await expect(announcement).toBeVisible();
});

test("turning off the custom mouse pointer persists immediately and after reload", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Appearance preference persistence is covered on desktop.");

  await page.goto("/");
  await page.locator('[data-tour="panel-settings"]').click();
  await page.getByRole("tab", { name: "Appearance" }).click();

  const cursorToggle = page.getByLabel("Custom Mouse Pointer");
  await expect(cursorToggle).toBeChecked();
  await page.getByText("Custom Mouse Pointer", { exact: true }).click();
  await expect(cursorToggle).not.toBeChecked();
  await page.waitForTimeout(100);

  const persistedCursorPreference = await page.evaluate(() => {
    const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
      state?: { customCursorEnabled?: unknown };
    };
    return persisted.state?.customCursorEnabled;
  });
  expect(persistedCursorPreference).toBe(false);

  await page.reload();
  await expect(page.getByLabel("Custom Mouse Pointer")).not.toBeChecked();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.marinaraCustomCursor ?? null))
    .toBeNull();
});

test("custom theme live preview batches stylesheet updates while typing", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tour="panel-settings"]').click();
  await page.getByRole("tab", { name: "Addons" }).click();
  await page.getByRole("button", { name: "Create Theme" }).click();

  const themeCssEditor = page.getByPlaceholder("/* Enter your CSS here... */");
  await expect(themeCssEditor).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.getElementById("marinara-css-editor-preview")?.textContent?.length ?? 0))
    .toBeGreaterThan(0);

  await page.evaluate(() => {
    const previewStyle = document.getElementById("marinara-css-editor-preview");
    if (!previewStyle) throw new Error("Expected the custom theme preview stylesheet");

    const trackedWindow = window as Window & {
      __themePreviewMutationCount?: number;
      __themePreviewObserver?: MutationObserver;
    };
    trackedWindow.__themePreviewMutationCount = 0;
    trackedWindow.__themePreviewObserver = new MutationObserver(() => {
      trackedWindow.__themePreviewMutationCount = (trackedWindow.__themePreviewMutationCount ?? 0) + 1;
    });
    trackedWindow.__themePreviewObserver.observe(previewStyle, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  });

  const previewMarker = "\n:root { --issue-4452-preview: ready; }";
  await themeCssEditor.pressSequentially(previewMarker, { delay: 2 });
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __themePreviewMutationCount?: number }).__themePreviewMutationCount ?? 0,
    ),
  ).toBe(0);

  await expect
    .poll(() => page.evaluate(() => document.getElementById("marinara-css-editor-preview")?.textContent ?? ""))
    .toContain("--issue-4452-preview: ready");
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __themePreviewMutationCount?: number }).__themePreviewMutationCount ?? 0,
    ),
  ).toBe(1);

  await page.getByRole("button", { name: "Preview" }).click();
  await expect.poll(() => page.locator("#marinara-css-editor-preview").count()).toBe(0);
});

test("gradient Accent Pulse keeps animating while Appearance settings are open", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Accent Pulse preview is covered on desktop.");

  await page.goto("/");
  await page.locator('[data-tour="panel-settings"]').click();
  await page.getByRole("tab", { name: "Appearance" }).click();
  const accentColorControl = page.locator("#settings-control-app-accent-color");
  await accentColorControl.getByRole("button", { name: /Default/ }).click();
  await accentColorControl.getByRole("button", { name: "Gradient", exact: true }).click();
  await page.getByText("Accent Pulse", { exact: true }).click();
  await expect(page.getByLabel("Accent Pulse")).toBeChecked();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset.marinaraAccentAnimation ?? null))
    .toBe("gradient");

  const firstAccent = await page.evaluate(() => document.documentElement.style.getPropertyValue("--primary"));
  await expect
    .poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--primary")))
    .not.toBe(firstAccent);
});

test("Android status bar setting reads and updates the native bridge", async ({ page }) => {
  await page.addInitScript(() => {
    const nativeWindow = window as Window & {
      MarinaraAndroid?: {
        isStatusBarVisible: () => boolean;
        setStatusBarVisible: (visible: boolean) => void;
      };
      __androidStatusBarChanges?: boolean[];
    };
    let visible = true;
    nativeWindow.__androidStatusBarChanges = [];
    nativeWindow.MarinaraAndroid = {
      isStatusBarVisible: () => visible,
      setStatusBarVisible: (nextVisible) => {
        visible = nextVisible;
        nativeWindow.__androidStatusBarChanges?.push(nextVisible);
      },
    };
  });

  await page.goto("/");
  await page.locator('[data-tour="panel-settings"]').click();

  const statusBarToggle = page.getByLabel("Show Android status bar");
  await expect(statusBarToggle).toBeChecked();

  await page.getByText("Show Android status bar", { exact: true }).click();
  await expect(statusBarToggle).not.toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __androidStatusBarChanges?: boolean[] }).__androidStatusBarChanges),
    )
    .toEqual([false]);

  await page.getByText("Show Android status bar", { exact: true }).click();
  await expect(statusBarToggle).toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __androidStatusBarChanges?: boolean[] }).__androidStatusBarChanges),
    )
    .toEqual([false, true]);

  await page.locator("#settings-control-language select").selectOption("pl");
  await expect(page.getByLabel("Pokaż pasek stanu Androida")).toBeChecked();
});

test("default dialogue color fills only cards without their own dialogue color", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Dialogue color precedence is covered on desktop.");

  const uncoloredCharacterResponse = await page.request.post("/api/characters", {
    data: { data: { name: "Global Dialogue Color" } },
  });
  expect(uncoloredCharacterResponse.ok()).toBeTruthy();
  const uncoloredCharacter = (await uncoloredCharacterResponse.json()) as { id: string };

  const coloredCharacterResponse = await page.request.post("/api/characters", {
    data: {
      data: {
        name: "Card Dialogue Color",
        extensions: { dialogueColor: "#22c55e" },
      },
    },
  });
  expect(coloredCharacterResponse.ok()).toBeTruthy();
  const coloredCharacter = (await coloredCharacterResponse.json()) as { id: string };

  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Default Dialogue Color Smoke",
      mode: "roleplay",
      characterIds: [uncoloredCharacter.id, coloredCharacter.id],
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const uncoloredMessageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        characterId: uncoloredCharacter.id,
        content: '"Use the global fallback."',
      },
    });
    expect(uncoloredMessageResponse.ok()).toBeTruthy();
    const uncoloredMessage = (await uncoloredMessageResponse.json()) as { id: string };

    const coloredMessageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        characterId: coloredCharacter.id,
        content: '"Keep the card override."',
      },
    });
    expect(coloredMessageResponse.ok()).toBeTruthy();
    const coloredMessage = (await coloredMessageResponse.json()) as { id: string };

    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");

    const uncoloredDialogue = page
      .locator(`[data-message-id="${uncoloredMessage.id}"] .mari-message-content strong`)
      .first();
    const coloredDialogue = page
      .locator(`[data-message-id="${coloredMessage.id}"] .mari-message-content strong`)
      .first();
    await expect(uncoloredDialogue).toBeVisible();
    await expect(coloredDialogue).toHaveCSS("color", "rgb(34, 197, 94)");

    await page.locator('[data-tour="panel-settings"]').click();
    await page.getByRole("tab", { name: "Appearance" }).click();
    const dialogueColorControl = page.locator("#settings-control-default-dialogue-color");
    await dialogueColorControl.scrollIntoViewIfNeeded();
    await expect(dialogueColorControl.locator('input[type="checkbox"]')).toHaveCount(0);
    await dialogueColorControl.getByRole("button", { name: /Scheme default/ }).click();
    await dialogueColorControl.getByLabel("Default Dialogue Color hex or CSS color").fill("#d946ef");

    await expect(uncoloredDialogue).toHaveCSS("color", "rgb(217, 70, 239)");
    await expect(coloredDialogue).toHaveCSS("color", "rgb(34, 197, 94)");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
            state?: { defaultDialogueColorEnabled?: unknown; defaultDialogueColor?: unknown };
          };
          return [persisted.state?.defaultDialogueColorEnabled ?? null, persisted.state?.defaultDialogueColor];
        }),
      )
      .toEqual([null, "#d946ef"]);
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
    await Promise.all([
      page.request.delete(`/api/characters/${uncoloredCharacter.id}`).catch(() => undefined),
      page.request.delete(`/api/characters/${coloredCharacter.id}`).catch(() => undefined),
    ]);
  }
});

test("roleplay hides contentless user anchors without hiding visible payloads", async ({ page }) => {
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Spatial-only Message Visibility Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const anchorResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "user", characterId: null, content: "" },
    });
    expect(anchorResponse.ok()).toBeTruthy();
    const anchor = (await anchorResponse.json()) as { id: string };

    const textResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "user", characterId: null, content: "We enter the kitchen." },
    });
    expect(textResponse.ok()).toBeTruthy();
    const textMessage = (await textResponse.json()) as { id: string };

    const attachmentResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "user", characterId: null, content: "" },
    });
    expect(attachmentResponse.ok()).toBeTruthy();
    const attachmentMessage = (await attachmentResponse.json()) as { id: string };
    const attachmentExtraResponse = await page.request.patch(
      `/api/chats/${chat.id}/messages/${attachmentMessage.id}/extra`,
      {
        data: {
          attachments: [
            {
              type: "image",
              data: `data:image/gif;base64,${TRANSPARENT_GIF_BASE64}`,
              filename: "spatial-only-control.gif",
            },
          ],
        },
      },
    );
    expect(attachmentExtraResponse.ok()).toBeTruthy();

    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");

    await expect(page.locator(`[data-message-id="${anchor.id}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-message-id="${textMessage.id}"]`)).toContainText("We enter the kitchen.");
    await expect(page.locator(`[data-message-id="${attachmentMessage.id}"]`)).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("Chat Settings adds a formatted greeting after the setup wizard is skipped", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Greeting chooser behavior is covered on desktop.");

  const suffix = Date.now().toString(36);
  const characterName = `Greeting Choice ${suffix}`;
  const firstGreeting = '*The chalk pauses over the diagram.* "Observe."';
  const alternateGreeting = '*The page turns to a fresh proof.* "Begin here."';
  const characterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        first_mes: firstGreeting,
        alternate_greetings: [alternateGreeting],
        extensions: { dialogueColor: "#22c55e" },
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };

  const chatResponse = await request.post("/api/chats", {
    data: {
      name: "Skipped Setup Greeting Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
    const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
      state?: Record<string, unknown>;
    };
    persisted.state = { ...(persisted.state ?? {}), chatFontColor: "#345678" };
    localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
  }, chat.id);

  try {
    await page.goto("/");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--marinara-chat-chrome-panel-text", "rgb(12, 34, 56)");
    });
    await page.evaluate(async () => {
      const { useChatStore } = (await import("/src/stores/chat.store.ts")) as {
        useChatStore: {
          getState: () => {
            setShouldOpenSettings: (open: boolean) => void;
            setShouldOpenWizard: (open: boolean) => void;
          };
        };
      };
      useChatStore.getState().setShouldOpenWizard(true);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    await expect(page.getByRole("heading", { name: "New Roleplay", exact: true })).toBeVisible();
    const setupWizard = page.locator('[data-component="ChatSetupWizard"]');
    const profileShortcut = setupWizard.getByRole("button", { name: "Use a Profile", exact: true });
    await expect(profileShortcut).toHaveAttribute(
      "title",
      "Apply a saved settings profile and pick a persona plus characters in one step",
    );
    await profileShortcut.click();
    await expect(setupWizard.getByRole("heading", { name: "Use a Profile", exact: true })).toBeVisible();
    await expect(
      setupWizard.getByText(
        "Pick a saved settings profile, your persona, and any characters in one compact setup pass.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(setupWizard.getByLabel("Profile", { exact: true })).toBeVisible();
    await setupWizard.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Skip", exact: true }).click();

    const drawer = page.locator(".mari-chat-settings-drawer");
    await expect(drawer).toBeVisible();
    const settingsProfileSelect = drawer.getByLabel("Profile", { exact: true });
    await expect(settingsProfileSelect).toHaveAttribute("title", "Apply a settings profile to this chat");
    await expect(settingsProfileSelect.locator("option:checked")).toHaveText("Custom settings profile");
    await expect(drawer.getByTitle("Cannot save into the Default profile")).toBeDisabled();
    await expect(drawer.getByTitle("Cannot rename the Default profile")).toBeDisabled();
    await expect(drawer.getByTitle("Save current chat settings as a new profile")).toBeEnabled();
    await expect(drawer.getByTitle("Import settings profile (.json)")).toBeEnabled();
    await expect(drawer.getByTitle("Export settings profile (.json)")).toBeEnabled();
    await expect(drawer.getByTitle("Cannot delete the Default profile")).toBeDisabled();
    await expect(
      drawer.locator('[data-chat-settings-section="roleplay-persona"] [role="button"]').first().locator("svg").first(),
    ).toHaveClass(/lucide-venetian-mask/u);
    await drawer.getByText("Characters", { exact: true }).first().click();
    await drawer.getByRole("button", { name: "Add Character", exact: true }).click();
    await drawer.getByPlaceholder("Search characters").fill(characterName);
    const characterOption = drawer.locator("button", { hasText: characterName }).last();
    const characterOptionContainer = characterOption.locator("..");
    await characterOption.hover();
    const [characterOptionBox, characterOptionContainerBox] = await Promise.all([
      characterOption.boundingBox(),
      characterOptionContainer.boundingBox(),
    ]);
    expect(characterOptionBox).not.toBeNull();
    expect(characterOptionContainerBox).not.toBeNull();
    expect(Math.abs(characterOptionBox!.width - characterOptionContainerBox!.width)).toBeLessThan(0.1);
    await expect(characterOption).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await characterOption.click();

    const greetingDialog = page.getByRole("dialog", { name: "Choose a Greeting", exact: true });
    await expect(greetingDialog).toBeVisible();
    await expect(greetingDialog.locator('[data-component="ChatSettingsDrawer.GreetingDialogHeader"] svg')).toHaveCount(
      0,
    );
    await expect(
      greetingDialog.getByText(`Choose which greeting ${characterName} should use when joining this chat.`),
    ).toHaveCSS("color", "rgb(12, 34, 56)");

    const firstOption = greetingDialog.getByRole("button", { name: /First Message/ });
    await expect(firstOption.locator(".mari-message-content").first()).toHaveCSS("color", "rgb(52, 86, 120)");
    await expect(firstOption.locator(".mari-message-content strong").first()).toHaveCSS("color", "rgb(34, 197, 94)");

    await greetingDialog.getByRole("button", { name: /Alternate Greeting #1/ }).click();
    await expect(drawer).toBeVisible();
    await greetingDialog.getByRole("button", { name: "Add Selected Greeting", exact: true }).click();
    await expect(greetingDialog).toBeHidden();
    await expect(drawer).toBeVisible();

    let greetingMessageId = "";
    await expect
      .poll(async () => {
        const messagesResponse = await request.get(`/api/chats/${chat.id}/messages`);
        const messages = (await messagesResponse.json()) as Array<{
          id: string;
          role: string;
          content: string;
          characterId?: string | null;
        }>;
        const greeting = messages.find((message) => message.content === alternateGreeting);
        greetingMessageId = greeting?.id ?? "";
        return greeting ? { role: greeting.role, characterId: greeting.characterId, content: greeting.content } : null;
      })
      .toEqual({
        role: "assistant",
        characterId: character.id,
        content: alternateGreeting,
      });
    await expect(page.locator(`[data-message-id="${greetingMessageId}"]`)).toBeVisible();
  } finally {
    await Promise.allSettled([
      request.delete(`/api/chats/${chat.id}`),
      request.delete(`/api/characters/${character.id}`),
    ]);
  }
});

test("Function Calling can require the first tool round per chat", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Function Calling settings are covered once on desktop.");

  const chatResponse = await request.post("/api/chats", {
    data: {
      name: "Required Tool Call Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);

  const readMetadata = async () => {
    const response = await request.get(`/api/chats/${chat.id}`);
    const stored = (await response.json()) as { metadata: string | Record<string, unknown> };
    return typeof stored.metadata === "string"
      ? (JSON.parse(stored.metadata) as Record<string, unknown>)
      : stored.metadata;
  };

  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();

    const section = page.locator('[data-chat-settings-section="function-calling"]');
    await section.locator('[role="button"][aria-expanded]').click();
    await section.getByText("Enable Tool Use", { exact: true }).click();

    const forceToolCall = section.getByLabel("Force To Call Tool", { exact: true });
    await expect(forceToolCall).toBeVisible();
    await expect(forceToolCall).not.toBeChecked();
    await section.getByText("Force To Call Tool", { exact: true }).click();
    await expect.poll(async () => (await readMetadata()).forceToolCall).toBe(true);

    await section.getByText("Force To Call Tool", { exact: true }).click();
    await expect.poll(async () => (await readMetadata()).forceToolCall).toBe(false);
  } finally {
    await request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("settings profile exports use the new identity and legacy exports still import", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Settings profile transfer contract is covered once.");

  const suffix = Date.now().toString(36);
  const createdIds = new Set<string>();
  const profileResponse = await request.post("/api/chat-presets", {
    data: {
      name: `Profile Transfer ${suffix}`,
      mode: "roleplay",
      settings: {},
    },
  });
  expect(profileResponse.ok()).toBeTruthy();
  const profile = (await profileResponse.json()) as { id: string };
  createdIds.add(profile.id);

  try {
    const exportResponse = await request.get(`/api/chat-presets/${profile.id}/export`);
    expect(exportResponse.ok()).toBeTruthy();
    expect(exportResponse.headers()["content-disposition"]).toContain(".marinara-settings-profile.json");
    const envelope = (await exportResponse.json()) as {
      type: string;
      version: number;
      exportedAt: string;
      data: { name: string; mode: string; settings: Record<string, unknown> };
    };
    expect(envelope.type).toBe("marinara_chat_settings_profile");

    const currentImportResponse = await request.post("/api/chat-presets/import", {
      data: {
        ...envelope,
        data: { ...envelope.data, name: `Current Profile Import ${suffix}` },
      },
    });
    expect(currentImportResponse.ok()).toBeTruthy();
    const currentImport = (await currentImportResponse.json()) as { id: string };
    createdIds.add(currentImport.id);

    const legacyImportResponse = await request.post("/api/chat-presets/import", {
      data: {
        ...envelope,
        type: "marinara_chat_preset",
        data: { ...envelope.data, name: `Legacy Profile Import ${suffix}` },
      },
    });
    expect(legacyImportResponse.ok()).toBeTruthy();
    const legacyImport = (await legacyImportResponse.json()) as { id: string };
    createdIds.add(legacyImport.id);

    const invalidSettingsResponse = await request.post("/api/chat-presets/import", {
      data: {
        ...envelope,
        data: {
          ...envelope.data,
          name: `Invalid Settings Profile ${suffix}`,
          settings: { connectionId: 42 },
        },
      },
    });
    expect(invalidSettingsResponse.status()).toBe(400);
    expect(await invalidSettingsResponse.json()).toEqual({ error: "Invalid settings profile settings" });

    const invalidImportResponse = await request.post("/api/chat-presets/import", {
      data: { type: "unknown", data: envelope.data },
    });
    expect(invalidImportResponse.status()).toBe(400);
    expect(await invalidImportResponse.json()).toEqual({ error: "Invalid settings profile file" });

    const profileListResponse = await request.get("/api/chat-presets?mode=roleplay");
    expect(profileListResponse.ok()).toBeTruthy();
    const profiles = (await profileListResponse.json()) as Array<{
      id: string;
      name: string;
      isDefault: boolean;
      isActive: boolean;
    }>;
    const defaultProfile = profiles.find((candidate) => candidate.isDefault);
    expect(defaultProfile).toBeTruthy();
    if (!defaultProfile) throw new Error("Expected the built-in Default settings profile");

    const renameDefaultResponse = await request.patch(`/api/chat-presets/${defaultProfile.id}`, {
      data: { name: `Renamed Default ${suffix}` },
    });
    expect(renameDefaultResponse.status()).toBe(400);
    expect(await renameDefaultResponse.json()).toEqual({ error: "Cannot rename the Default settings profile" });
    const defaultAfterRenameResponse = await request.get(`/api/chat-presets/${defaultProfile.id}`);
    expect(defaultAfterRenameResponse.ok()).toBeTruthy();
    expect((await defaultAfterRenameResponse.json()) as { name: string }).toMatchObject({ name: defaultProfile.name });

    const [activateCurrentResponse, activateLegacyResponse] = await Promise.all([
      request.post(`/api/chat-presets/${currentImport.id}/set-active`),
      request.post(`/api/chat-presets/${legacyImport.id}/set-active`),
    ]);
    expect(activateCurrentResponse.ok()).toBeTruthy();
    expect(activateLegacyResponse.ok()).toBeTruthy();
    const activeListResponse = await request.get("/api/chat-presets?mode=roleplay");
    expect(activeListResponse.ok()).toBeTruthy();
    const activeProfiles = (await activeListResponse.json()) as Array<{ isActive: boolean }>;
    expect(activeProfiles.filter((candidate) => candidate.isActive)).toHaveLength(1);

    const raceProfileResponse = await request.post("/api/chat-presets", {
      data: {
        name: `Activation Removal Race ${suffix}`,
        mode: "roleplay",
        settings: {},
      },
    });
    expect(raceProfileResponse.ok()).toBeTruthy();
    const raceProfile = (await raceProfileResponse.json()) as { id: string };
    const [raceActivationResponse, raceRemovalResponse] = await Promise.all([
      request.post(`/api/chat-presets/${raceProfile.id}/set-active`),
      request.delete(`/api/chat-presets/${raceProfile.id}`),
    ]);
    expect([200, 404]).toContain(raceActivationResponse.status());
    expect(raceRemovalResponse.status()).toBe(204);
    const postRaceListResponse = await request.get("/api/chat-presets?mode=roleplay");
    expect(postRaceListResponse.ok()).toBeTruthy();
    const postRaceProfiles = (await postRaceListResponse.json()) as Array<{ isActive: boolean }>;
    expect(postRaceProfiles.filter((candidate) => candidate.isActive)).toHaveLength(1);
  } finally {
    await Promise.allSettled([...createdIds].map((id) => request.delete(`/api/chat-presets/${id}`)));
  }
});

test("settings profiles cannot carry Hierarchical Maps state into another chat", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Settings profile map isolation is covered once.");

  const suffix = Date.now().toString(36);
  let profileId = "";
  let chatId = "";
  const profileResponse = await request.post("/api/chat-presets", {
    data: {
      name: `Map Isolation ${suffix}`,
      mode: "roleplay",
      settings: {
        metadata: {
          enableAgents: true,
          activeAgentIds: ["hierarchical-maps"],
          spatialContext: { locations: [{ id: "falmart", name: "Falmart" }] },
          spatialContextHierarchyProfile: { name: "Inherited map hierarchy" },
          spatialMapGenerationPreferences: { activeOptionId: "inherited-map-option" },
        },
      },
    },
  });
  expect(profileResponse.ok(), await profileResponse.text()).toBeTruthy();
  const profile = (await profileResponse.json()) as {
    id: string;
    settings: { metadata?: Record<string, unknown> };
  };
  profileId = profile.id;

  try {
    expect(profile.settings.metadata).toMatchObject({
      enableAgents: true,
      activeAgentIds: ["hierarchical-maps"],
    });
    expect(profile.settings.metadata).not.toHaveProperty("spatialContext");
    expect(profile.settings.metadata).not.toHaveProperty("spatialContextHierarchyProfile");
    expect(profile.settings.metadata).not.toHaveProperty("spatialMapGenerationPreferences");

    const chatResponse = await request.post("/api/chats", {
      data: {
        name: `Fresh RP without inherited map ${suffix}`,
        mode: "roleplay",
        characterIds: [],
      },
    });
    expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string };
    chatId = chat.id;

    const applyResponse = await request.post(`/api/chat-presets/${profile.id}/apply/${chat.id}`);
    expect(applyResponse.ok(), await applyResponse.text()).toBeTruthy();
    const appliedChatResponse = await request.get(`/api/chats/${chat.id}`);
    expect(appliedChatResponse.ok(), await appliedChatResponse.text()).toBeTruthy();
    const appliedChat = (await appliedChatResponse.json()) as { metadata?: Record<string, unknown> };
    expect(appliedChat.metadata).toMatchObject({
      enableAgents: true,
      activeAgentIds: ["hierarchical-maps"],
    });
    expect(appliedChat.metadata).not.toHaveProperty("spatialContext");
    expect(appliedChat.metadata).not.toHaveProperty("spatialContextHierarchyProfile");
    expect(appliedChat.metadata).not.toHaveProperty("spatialMapGenerationPreferences");
  } finally {
    await Promise.allSettled([
      chatId ? request.delete(`/api/chats/${chatId}`) : Promise.resolve(),
      profileId ? request.delete(`/api/chat-presets/${profileId}`) : Promise.resolve(),
    ]);
  }
});

test("Author's Notes keeps its expand and full macro guide inside the field", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Author's Notes field chrome is covered on desktop.");

  const chatResponse = await request.post("/api/chats", {
    data: {
      name: "Author Notes Macro Field Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);

  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Author's Notes", exact: true }).filter({ visible: true }).click();

    const heading = page.locator("h3").filter({ hasText: "Author's Notes" });
    await expect(heading).toBeVisible();
    const panel = heading.locator("..");
    const field = panel.locator(".mari-author-notes-field");
    await expect(field.getByRole("textbox", { name: "Author's Notes", exact: true })).toBeVisible();
    await expect(heading.getByRole("button", { name: "Expand editor", exact: true })).toHaveCount(0);
    await expect(field.getByRole("button", { name: "Expand editor", exact: true })).toBeVisible();
    await expect(field.getByRole("button", { name: "Macro reference", exact: true })).toBeVisible();

    await field.getByRole("button", { name: "Macro reference", exact: true }).click();
    const macroReference = page.locator('[data-component="MacroReference"]');
    await expect(macroReference).toBeVisible();
    await expect(macroReference.getByText("{{charPostHistory}}", { exact: true })).toBeVisible();
    await expect(macroReference.getByText("{{agent::TYPE}}", { exact: true })).toBeVisible();
    await expect(macroReference.getByText(/Conditional block with/)).toBeVisible();
    await macroReference.getByRole("button", { name: "Close macro reference", exact: true }).click();
    await expect(panel).toBeVisible();

    await field.getByRole("button", { name: "Expand editor", exact: true }).click();
    const expandedEditor = page.locator('[data-component="ExpandedMacroEditor"]');
    await expect(expandedEditor).toBeVisible();
    const savedNotes = '{{#if char == "Albedo"}}Keep {{user}} curious.{{else}}Keep the scene curious.{{/if}}';
    await expandedEditor.locator("textarea").fill(savedNotes);
    await expandedEditor.getByRole("button", { name: "Close expanded editor", exact: true }).click();
    await expect(panel).toBeVisible();
    await expect
      .poll(async () => {
        const storedResponse = await request.get(`/api/chats/${chat.id}`);
        const stored = (await storedResponse.json()) as { metadata: string | Record<string, unknown> };
        const metadata =
          typeof stored.metadata === "string"
            ? (JSON.parse(stored.metadata) as Record<string, unknown>)
            : stored.metadata;
        return metadata.authorNotes;
      })
      .toBe(savedNotes);
  } finally {
    await request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("Author's Notes resolves the shared prompt macro engine and preset variables", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Author's Notes prompt resolution is covered once.");

  const suffix = Date.now().toString(36);
  const characterName = `Author Notes Character ${suffix}`;
  const personaName = `Author Notes Persona ${suffix}`;
  const connectionResponse = await request.post("/api/connections", {
    data: {
      name: `Author Notes Dry Run ${suffix}`,
      provider: "custom",
      baseUrl: "http://127.0.0.1:1/v1",
      apiKey: "author-notes-e2e",
      model: "author-notes-model",
      maxContext: 32768,
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };

  const characterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        description: "A meticulous alchemist.",
        personality: "Patient and exacting.",
        scenario: "Inside a mountain laboratory.",
        mes_example: '"Record every result."',
        post_history_instructions: "Never lose the thread.",
        extensions: {
          backstory: "He has studied this reaction for years.",
          appearance: "A pale coat and blue gloves.",
        },
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };

  const personaResponse = await request.post("/api/characters/personas", {
    data: {
      name: personaName,
      description: "A curious research partner.",
      personality: "Inquisitive.",
      backstory: "Trained in field observation.",
      appearance: "A dark traveling coat.",
      scenario: "Assisting with the experiment.",
    },
  });
  expect(personaResponse.ok()).toBeTruthy();
  const persona = (await personaResponse.json()) as { id: string };

  const presetResponse = await request.post("/api/prompts", {
    data: {
      name: `Author Notes Macro Preset ${suffix}`,
      description: "Author's Notes macro-resolution fixture.",
      variableValues: { AUTHOR_TONE: "forensic" },
    },
  });
  expect(presetResponse.ok()).toBeTruthy();
  const preset = (await presetResponse.json()) as { id: string };
  const sectionResponse = await request.post(`/api/prompts/${preset.id}/sections`, {
    data: {
      identifier: `author_notes_base_${suffix}`,
      name: "Base Prompt",
      content: "Continue the roleplay.",
      role: "system",
    },
  });
  expect(sectionResponse.ok()).toBeTruthy();

  const chatResponse = await request.post("/api/chats", {
    data: {
      name: "Author Notes Macro Resolution Smoke",
      mode: "roleplay",
      characterIds: [character.id],
      personaId: persona.id,
      connectionId: connection.id,
      promptPresetId: preset.id,
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const authorNotes = [
    "AUTHOR_NOTES_MACRO_PROBE",
    "identity={{user}}|{{char}}|{{characters}}|{{personaDescription}}",
    "character={{description}}|{{personality}}|{{backstory}}|{{appearance}}|{{scenario}}|{{example}}|{{charPostHistory}}",
    "context={{input}}|{{model}}|{{chatId}}|{{lastGenerationType}}",
    "preset={{AUTHOR_TONE}}",
    "random={{random:7:7}}|{{roll:1d1}}",
    "variables={{setvar::count::1}}{{incvar::count}}{{getvar::count}}",
    "format={{uppercase}}quiet{{/uppercase}}|{{lowercase}}LOUD{{/lowercase}}|A{{newline}}B",
    `conditional={{#if char == "${characterName}"}}matched{{else}}missed{{/if}}`,
    "comment={{// hidden}}visible|noop={{noop}}done|agent={{agent::missing-agent}}",
  ].join("\n");
  const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { authorNotes, authorNotesDepth: 0 },
  });
  expect(metadataResponse.ok()).toBeTruthy();
  const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
    data: { role: "user", content: "Measure the blue precipitate." },
  });
  expect(messageResponse.ok()).toBeTruthy();

  try {
    const dryRunResponse = await request.post("/api/generate/dryRun", {
      data: {
        chatId: chat.id,
        returnPrompt: true,
      },
    });
    expect(dryRunResponse.ok()).toBeTruthy();
    const dryRun = (await dryRunResponse.json()) as {
      prompt: { messages: Array<{ role: string; content: string }> };
    };
    const prompt = dryRun.prompt.messages.map((message) => message.content).join("\n\n");
    const probe = prompt.slice(prompt.indexOf("AUTHOR_NOTES_MACRO_PROBE"));

    expect(probe).toContain(`identity=${personaName}|${characterName}|${characterName}|A curious research partner.`);
    expect(probe).toContain(
      'character=A meticulous alchemist.|Patient and exacting.|He has studied this reaction for years.|A pale coat and blue gloves.|Inside a mountain laboratory.|"Record every result."|Never lose the thread.',
    );
    expect(probe).toContain(`context=Measure the blue precipitate.|author-notes-model|${chat.id}|continue`);
    expect(probe).toContain("preset=forensic");
    expect(probe).toContain("random=7|1");
    expect(probe).toContain("variables=2");
    expect(probe).toContain("format=QUIET|loud|A\nB");
    expect(probe).toContain("conditional=matched");
    expect(probe).toContain("comment=visible|noop=done|agent=");
    expect(probe).not.toContain("{{");
  } finally {
    await Promise.allSettled([
      request.delete(`/api/chats/${chat.id}`),
      request.delete(`/api/prompts/${preset.id}`),
      request.delete(`/api/characters/${character.id}`),
      request.delete(`/api/characters/personas/${persona.id}`),
      request.delete(`/api/connections/${connection.id}`),
    ]);
  }
});

test("message deletion uses unified chroma controls and selection states", async ({ page }, testInfo) => {
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Message Delete Chroma Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const messageResponses = await Promise.all(
      ["Keep this turn.", "Start selecting here.", "Keep the final turn."].map((content) =>
        page.request.post(`/api/chats/${chat.id}/messages`, {
          data: { role: "user", content },
        }),
      ),
    );
    for (const response of messageResponses) expect(response.ok()).toBeTruthy();
    const messages = (await Promise.all(messageResponses.map((response) => response.json()))) as Array<{
      id: string;
    }>;
    const targetMessage = messages[1];
    const assistantMessageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "First assistant swipe." },
    });
    expect(assistantMessageResponse.ok()).toBeTruthy();
    const assistantMessage = (await assistantMessageResponse.json()) as { id: string };
    const assistantSwipeResponse = await page.request.post(
      `/api/chats/${chat.id}/messages/${assistantMessage.id}/swipes`,
      { data: { content: "Alternate assistant swipe." } },
    );
    expect(assistantSwipeResponse.ok()).toBeTruthy();

    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");
    await setAppAccentColor(page, "#14b8a6");

    const messageRow = page.locator(`[data-message-id="${targetMessage.id}"]`);
    await expect(messageRow).toBeVisible();
    if (testInfo.project.name.includes("mobile")) {
      await messageRow.click({ position: { x: 80, y: 24 } });
    } else {
      await messageRow.hover();
    }

    const openDeleteButton = messageRow.getByRole("button", { name: "Delete" });
    await expect(openDeleteButton).toBeVisible();
    await openDeleteButton.click();

    const dialog = page.getByRole("dialog", { name: "Delete message" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Choose what you want to remove from this message.")).toBeVisible();

    const dialogActions = dialog.locator('[data-component="MessageDeleteActions"] > button');
    await expect(dialogActions).toHaveCount(3);
    await expect(dialog.getByRole("button", { name: "Delete this message" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Delete more" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();

    const readChromeStyles = (locator: typeof dialogActions) =>
      locator.evaluateAll((buttons) =>
        buttons.map((button) => {
          const style = getComputedStyle(button);
          return {
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            color: style.color,
            className: button.className,
          };
        }),
      );
    const tealStyles = await readChromeStyles(dialogActions);
    expect(new Set(tealStyles.map(({ backgroundColor }) => backgroundColor)).size).toBe(1);
    expect(new Set(tealStyles.map(({ borderColor }) => borderColor)).size).toBe(1);
    expect(new Set(tealStyles.map(({ color }) => color)).size).toBe(1);
    for (const { className } of tealStyles) {
      expect(className).not.toMatch(/destructive|pink|red|rose/iu);
    }

    await setAppAccentColor(page, "#3b82f6");
    await expect.poll(async () => (await readChromeStyles(dialogActions))[0]?.color).not.toBe(tealStyles[0]?.color);
    const blueStyles = await readChromeStyles(dialogActions);
    expect(new Set(blueStyles.map(({ backgroundColor }) => backgroundColor)).size).toBe(1);
    expect(new Set(blueStyles.map(({ borderColor }) => borderColor)).size).toBe(1);
    expect(new Set(blueStyles.map(({ color }) => color)).size).toBe(1);

    await testInfo.attach(`message-delete-dialog-${testInfo.project.name}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    await dialog.getByRole("button", { name: "Delete more" }).click();
    const selectionBar = page.locator('[data-component="MessageMultiSelectBar"]');
    await expect(selectionBar).toBeVisible();
    await expect(selectionBar).toContainText(/\d+ selected/);

    const deleteSelected = selectionBar.getByRole("button", { name: "Delete selected" });
    const cancelSelection = selectionBar.getByRole("button", { name: "Cancel" });
    const selectionActions = selectionBar.locator("button").filter({ hasText: /Delete selected|Cancel/ });
    await expect(deleteSelected).toBeEnabled();
    await expect(cancelSelection).toBeVisible();
    const selectionActionStyles = await readChromeStyles(selectionActions);
    expect(selectionActionStyles).toHaveLength(2);
    expect(selectionActionStyles[0]).toEqual(selectionActionStyles[1]);

    const selectedCheckbox = messageRow.getByRole("checkbox", { name: "Deselect message" });
    await expect(selectedCheckbox).toBeVisible();
    await expect(selectedCheckbox).toHaveCSS("background-color", "rgb(59, 130, 246)");
    const selectionClassNames = await page
      .locator('[aria-checked="true"], [data-component="MessageMultiSelectBar"]')
      .evaluateAll((elements) => elements.map((element) => element.className));
    for (const className of selectionClassNames) {
      expect(className).not.toMatch(/destructive|pink|red|rose/iu);
    }

    await testInfo.attach(`message-delete-${testInfo.project.name}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });

    await cancelSelection.click();
    await expect(selectionBar).toBeHidden();

    const assistantRow = page.locator(`[data-message-id="${assistantMessage.id}"]`);
    await expect(assistantRow).toContainText("Alternate assistant swipe.");
    if (testInfo.project.name.includes("mobile")) {
      await assistantRow.click({ position: { x: 80, y: 24 } });
    } else {
      await assistantRow.hover();
    }
    await assistantRow.getByRole("button", { name: "Delete" }).click();
    await expect(dialog).toBeVisible();

    const assistantDialogActions = dialog.locator('[data-component="MessageDeleteActions"] > button');
    await expect(assistantDialogActions).toHaveCount(4);
    const deleteSwipe = dialog.getByRole("button", { name: "Delete only this swipe (2/2)" });
    await expect(deleteSwipe).toBeVisible();
    const swipeStyles = await readChromeStyles(deleteSwipe);
    const deleteMessageStyles = await readChromeStyles(dialog.getByRole("button", { name: "Delete this message" }));
    expect(swipeStyles).toHaveLength(1);
    expect(swipeStyles[0]).toEqual(deleteMessageStyles[0]);
    expect(swipeStyles[0]?.color).not.toBe(tealStyles[0]?.color);
    expect(swipeStyles[0]?.className).not.toMatch(/destructive|pink|red|rose/iu);

    await deleteSwipe.click();
    await expect(dialog).toBeHidden();
    await expect
      .poll(async () => {
        const response = await page.request.get(`/api/chats/${chat.id}/messages/${assistantMessage.id}/swipes`);
        if (!response.ok()) return -1;
        return ((await response.json()) as unknown[]).length;
      })
      .toBe(1);
    await expect(assistantRow).toContainText("First assistant swipe.");
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("bulk chat deletion uses the shared primary accent control", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop chat-sidebar selection chrome is covered here.");

  const chatNames = ["Bulk Delete Chroma One", "Bulk Delete Chroma Two"];
  const chatResponses = await Promise.all(
    chatNames.map((name) =>
      page.request.post("/api/chats", {
        data: { name, mode: "roleplay", characterIds: [] },
      }),
    ),
  );
  for (const response of chatResponses) expect(response.ok()).toBeTruthy();
  const chats = (await Promise.all(chatResponses.map((response) => response.json()))) as Array<{ id: string }>;

  try {
    await page.addInitScript((activeChatId) => {
      localStorage.setItem("marinara-active-chat-id", activeChatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            sidebarOpen: true,
          },
          version: 75,
        }),
      );
    }, chats[0]!.id);
    await page.goto("/");
    await setAppAccentColor(page, "#14b8a6");
    const activeAccentColor = await readCssVariableColor(page, "--marinara-chat-chrome-button-text-active");

    const sidebar = page.locator('[data-component="ChatSidebar"]');
    await expect(sidebar).toBeVisible();
    const firstChatRow = sidebar.locator(`[data-chat-id="${chats[0]!.id}"]`);
    await firstChatRow.hover();
    await firstChatRow.getByRole("button", { name: `Delete ${chatNames[0]}`, exact: true }).click();
    const namedDeleteDialog = page.getByRole("dialog", { name: "Delete Chat" });
    await expect(namedDeleteDialog).toContainText(
      `Are you sure you want to delete ${chatNames[0]}? This cannot be undone.`,
    );
    await namedDeleteDialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await sidebar.getByRole("button", { name: "Select chats" }).click();
    for (const chat of chats) {
      await sidebar.locator(`[data-chat-id="${chat.id}"]`).click();
    }

    const actionBar = sidebar.locator(".mari-selection-action-bar");
    await expect(actionBar).toContainText("2 selected");
    const exportAction = actionBar.getByRole("button", { name: "Export" });
    const deleteAction = actionBar.getByRole("button", { name: "Delete" });
    await expect(exportAction).toBeEnabled();
    await expect(deleteAction).toBeEnabled();

    const styles = await actionBar.locator("button").evaluateAll((buttons) =>
      buttons.map((button) => {
        const style = getComputedStyle(button);
        return {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          color: style.color,
          className: button.className,
        };
      }),
    );
    expect(styles).toHaveLength(2);
    await expect(deleteAction).toHaveClass(/mari-chrome-control--primary/u);
    await expect(deleteAction).toHaveCSS("color", activeAccentColor);
    expect(styles[1]?.className).not.toMatch(/danger|destructive|pink|red|rose/iu);

    await deleteAction.click();
    const dialog = page.getByRole("dialog", { name: "Delete Chats" });
    await expect(dialog).toBeVisible();
    const confirmDelete = dialog.getByRole("button", { name: "Delete", exact: true });
    await expect(confirmDelete).toHaveClass(/mari-chrome-control--primary/u);
    expect(await confirmDelete.getAttribute("class")).not.toMatch(/destructive|pink|red|rose/iu);
    await dialog.getByRole("button", { name: "Cancel" }).click();
  } finally {
    await Promise.all(chats.map((chat) => page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined)));
  }
});

test("empty chat hover previews inherit the configured accent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Chat row hover previews are desktop-only.");

  const response = await page.request.post("/api/chats", {
    data: { name: "Empty Chat Accent Preview", mode: "conversation", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };

  try {
    await page.addInitScript(() => {
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            sidebarOpen: true,
          },
          version: 75,
        }),
      );
    });
    await page.goto("/");
    await setAppAccentColor(page, "#14b8a6");
    const activeAccentColor = await readCssVariableColor(page, "--marinara-chat-chrome-button-text-active");

    const chatRow = page.locator(`[data-component="ChatSidebar"] [data-chat-id="${chat.id}"]`);
    await expect(chatRow).toBeVisible();
    await chatRow.hover();

    const emptyPreview = page.getByRole("tooltip").getByText("No messages yet", { exact: true });
    await expect(emptyPreview).toBeVisible();
    await expect(emptyPreview).toHaveCSS("color", activeAccentColor);
    expect(await emptyPreview.getAttribute("class")).not.toMatch(/pink|red|rose/iu);
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("resource panel sort fields share the canonical width", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop resource panel control geometry is covered here.");

  await page.goto("/");
  const rightPanel = page.locator('[data-component="RightPanelDesktop"]');

  await page.locator('[data-tour="panel-lorebooks"]').click();
  const lorebookSort = rightPanel.locator("select.mari-chrome-sort-field:visible");
  await expect(lorebookSort).toBeVisible();
  const lorebookWidth = await lorebookSort.evaluate((element) => element.getBoundingClientRect().width);

  await page.locator('[data-tour="panel-personas"]').click();
  const personaSort = rightPanel.locator("select.mari-chrome-sort-field:visible");
  await expect(personaSort).toBeVisible();
  const personaWidth = await personaSort.evaluate((element) => element.getBoundingClientRect().width);
  const rootFontSize = await page.locator("html").evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).fontSize),
  );

  expect(lorebookWidth / rootFontSize).toBeCloseTo(6.5, 2);
  expect(lorebookWidth).toBe(personaWidth);
});

test("destructive confirmation actions use the shared accent button treatment", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop confirmation-dialog chrome is covered here.");

  await page.goto("/");
  await setAppAccentColor(page, "#14b8a6");
  const activeAccentColor = await readCssVariableColor(page, "--marinara-chat-chrome-button-text-active");
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--destructive", "rgb(255, 0, 0)");
  });

  await page.evaluate(async () => {
    const { showConfirmDialog } = (await import("/src/lib/app-dialogs.ts")) as {
      showConfirmDialog: (options: {
        title: string;
        message: string;
        confirmLabel: string;
        tone: "destructive";
      }) => Promise<boolean>;
    };
    void showConfirmDialog({
      title: "Delete Resource",
      message: "This representative resource deletion uses the shared confirmation renderer.",
      confirmLabel: "Delete",
      tone: "destructive",
    });
  });

  const confirmDialog = page.getByRole("dialog", { name: "Delete Resource" });
  const confirmDelete = confirmDialog.getByRole("button", { name: "Delete", exact: true });
  await expect(confirmDelete).toHaveClass(/mari-chrome-control--primary/u);
  await expect(confirmDelete).toHaveCSS("color", activeAccentColor);
  expect(await confirmDelete.getAttribute("class")).not.toMatch(/destructive|pink|red|rose/iu);
  await confirmDialog.getByRole("button", { name: "Cancel" }).click();

  await page.evaluate(async () => {
    const { showChoiceDialog } = (await import("/src/lib/app-dialogs.ts")) as {
      showChoiceDialog: (options: {
        title: string;
        message: string;
        choices: Array<{ key: string; label: string; tone: "destructive" }>;
      }) => Promise<string | null>;
    };
    void showChoiceDialog({
      title: "Delete Resources",
      message: "Choose the deletion scope.",
      choices: [{ key: "all", label: "Delete All", tone: "destructive" }],
    });
  });

  const choiceDialog = page.getByRole("dialog", { name: "Delete Resources" });
  const deleteAll = choiceDialog.getByRole("button", { name: "Delete All", exact: true });
  await expect(deleteAll).toHaveClass(/mari-chrome-control--primary/u);
  await expect(deleteAll).toHaveCSS("color", activeAccentColor);
  expect(await deleteAll.getAttribute("class")).not.toMatch(/destructive|pink|red|rose/iu);
  await choiceDialog.getByRole("button", { name: "Cancel" }).click();
});

test("modal backdrops ignore drag releases but still close on a fresh outside click", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const { showConfirmDialog } = (await import("/src/lib/app-dialogs.ts")) as {
      showConfirmDialog: (options: { title: string; message: string; confirmLabel: string }) => Promise<boolean>;
    };
    void showConfirmDialog({
      title: "Resize Gesture Guard",
      message: "A drag that ends outside must not dismiss this window.",
      confirmLabel: "Keep",
    });
  });

  const dialog = page.getByRole("dialog", { name: "Resize Gesture Guard" });
  const panel = dialog.locator(".mari-modal-panel");
  const backdrop = dialog.locator("[data-backdrop-dismiss-surface]");
  await expect(dialog).toBeVisible();

  await panel.dispatchEvent("pointerdown", { bubbles: true, pointerId: 1, pointerType: "mouse" });
  await backdrop.dispatchEvent("pointerup", { bubbles: true, pointerId: 1, pointerType: "mouse" });
  await backdrop.dispatchEvent("click", { bubbles: true });
  await expect(dialog).toBeVisible();

  await backdrop.click({ position: { x: 4, y: 4 } });
  await expect(dialog).toHaveCount(0);
});

test("connection model fetch errors inherit the configured editor accent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop connection editor chrome is covered here.");

  const connectionResponse = await page.request.post("/api/connections", {
    data: {
      name: "Connection Fetch Error Chroma",
      provider: "custom",
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  const networkError = "NetworkError when attempting to fetch resource.";
  const internalServerError = "Internal Server Error";
  const accentColor = "rgb(20, 184, 166)";
  let fetchCount = 0;

  try {
    await page.route(`**/api/connections/${connection.id}/models`, async (route) => {
      const message = fetchCount === 0 ? networkError : internalServerError;
      fetchCount += 1;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: { message } }),
      });
    });
    await page.goto("/");
    await page.evaluate(async (accent) => {
      const { useUIStore } = (await import("/src/stores/ui.store.ts")) as {
        useUIStore: {
          getState: () => {
            setAppAccentColor: (color: string) => void;
          };
        };
      };
      useUIStore.getState().setAppAccentColor(accent);
    }, "#14b8a6");
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--marinara-app-accent-static").trim(),
        ),
      )
      .toBe("#14b8a6");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--marinara-chat-chrome-panel-text", "rgb(236, 72, 153)");
      document.documentElement.style.setProperty("--destructive", "rgb(255, 0, 0)");
    });

    await page.locator('[data-tour="panel-connections"]').click();
    const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
    await rightPanel
      .getByText("Connection Fetch Error Chroma", { exact: true })
      .first()
      .evaluate((element) => (element as HTMLElement).click());

    const editor = page.locator(".mari-editor-shell");
    await expect(editor).toBeVisible();
    await editor.getByText("Select a model…", { exact: true }).click();
    await editor.getByRole("button", { name: "Fetch Models from API" }).click();

    const errorText = editor.getByText(networkError, { exact: true });
    await expect(errorText).toBeVisible();
    await expect(errorText).toHaveCSS("color", accentColor);
    expect(await errorText.getAttribute("class")).not.toMatch(/destructive|pink|red|rose/iu);

    await editor.getByRole("button", { name: "Fetch Models from API" }).click();
    const internalErrorText = editor.getByText(internalServerError, { exact: true });
    await expect(internalErrorText).toBeVisible();
    await expect(internalErrorText).toHaveCSS("color", accentColor);
    expect(await internalErrorText.getAttribute("class")).not.toMatch(/destructive|pink|red|rose/iu);
  } finally {
    await page.request.delete(`/api/connections/${connection.id}`).catch(() => undefined);
  }
});

test("connection test-message errors inherit the configured editor accent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop connection editor chrome is covered here.");

  const connectionResponse = await page.request.post("/api/connections", {
    data: {
      name: "Connection Message Error Chroma",
      provider: "custom",
      baseUrl: "https://example.invalid",
      model: "accent-test-model",
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  const internalServerError = "Internal Server Error";
  const accentColor = "rgb(20, 184, 166)";

  try {
    await page.route(`**/api/connections/${connection.id}/test-message`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          response: "",
          latencyMs: 1,
          error: internalServerError,
        }),
      });
    });
    await page.goto("/");
    await page.evaluate(async (accent) => {
      const { useUIStore } = (await import("/src/stores/ui.store.ts")) as {
        useUIStore: {
          getState: () => {
            setAppAccentColor: (color: string) => void;
          };
        };
      };
      useUIStore.getState().setAppAccentColor(accent);
    }, "#14b8a6");
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--marinara-app-accent-static").trim(),
        ),
      )
      .toBe("#14b8a6");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--destructive", "rgb(255, 0, 0)");
    });

    await page.locator('[data-tour="panel-connections"]').click();
    const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
    await rightPanel
      .getByText("Connection Message Error Chroma", { exact: true })
      .first()
      .evaluate((element) => (element as HTMLElement).click());

    const editor = page.locator(".mari-editor-shell");
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "Send Test Message" }).click();

    const errorText = editor.getByText(internalServerError, { exact: true });
    await expect(errorText).toBeVisible();
    await expect(errorText).toHaveCSS("color", accentColor);
    expect(await errorText.getAttribute("class")).not.toMatch(/destructive|pink|red|rose/iu);
  } finally {
    await page.request.delete(`/api/connections/${connection.id}`).catch(() => undefined);
  }
});

test("Connection image captioning defaults persist with a dedicated captioning connection", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop connection-default editing is covered here.");

  const suffix = Date.now().toString(36);
  const chatConnectionName = `Caption Defaults Chat ${suffix}`;
  const captionConnectionName = `Caption Defaults Vision ${suffix}`;
  const captionModel = `vision-model-${suffix}`;
  const chatConnectionResponse = await request.post("/api/connections", {
    data: {
      name: chatConnectionName,
      provider: "custom",
      baseUrl: "http://127.0.0.1:1/v1",
      model: `chat-model-${suffix}`,
    },
  });
  const captionConnectionResponse = await request.post("/api/connections", {
    data: {
      name: captionConnectionName,
      provider: "custom",
      baseUrl: "http://127.0.0.1:1/v1",
      model: captionModel,
    },
  });
  expect(chatConnectionResponse.ok()).toBeTruthy();
  expect(captionConnectionResponse.ok()).toBeTruthy();
  const chatConnection = (await chatConnectionResponse.json()) as { id: string };
  const captionConnection = (await captionConnectionResponse.json()) as { id: string };

  try {
    const invalidDefaultsResponse = await request.put(`/api/connections/${chatConnection.id}/default-parameters`, {
      data: {
        imageCaptioningEnabled: true,
        imageCaptioningConnectionId: "",
      },
    });
    expect(invalidDefaultsResponse.status()).toBe(400);

    await page.goto("/");
    await page.locator('[data-tour="panel-connections"]').click();
    const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
    await rightPanel
      .getByText(chatConnectionName, { exact: true })
      .first()
      .evaluate((element) => (element as HTMLElement).click());

    const editor = page.locator(".mari-editor-shell");
    await expect(editor).toBeVisible();
    await editor
      .getByText("Use custom defaults for this connection", { exact: true })
      .evaluate((element) => (element as HTMLElement).click());
    await expect(editor.getByRole("checkbox", { name: "Use custom defaults for this connection" })).toBeChecked();
    await editor.getByText("Image Captioning", { exact: true }).click();
    await expect(editor.getByRole("checkbox", { name: "Image Captioning" })).toBeChecked();
    const captioningSelect = editor
      .getByText("Captioning Connection", { exact: true })
      .locator("..")
      .getByRole("combobox");
    await captioningSelect.selectOption(captionConnection.id);

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/connections/${chatConnection.id}/default-parameters`) &&
          response.request().method() === "PUT" &&
          response.ok(),
      ),
      editor.getByRole("button", { name: "Save", exact: true }).click(),
    ]);

    const storedResponse = await request.get(`/api/connections/${chatConnection.id}`);
    expect(storedResponse.ok()).toBeTruthy();
    const stored = (await storedResponse.json()) as { defaultParameters: string | null };
    const storedDefaults = JSON.parse(stored.defaultParameters ?? "{}") as Record<string, unknown>;
    expect(storedDefaults.imageCaptioningEnabled).toBe(true);
    expect(storedDefaults.imageCaptioningConnectionId).toBe(captionConnection.id);

    await editor.locator(".mari-editor-header .mari-editor-action").first().click();
    await rightPanel
      .getByText(chatConnectionName, { exact: true })
      .first()
      .evaluate((element) => (element as HTMLElement).click());
    await expect(editor.getByRole("checkbox", { name: "Use custom defaults for this connection" })).toBeChecked();
    await expect(editor.getByRole("checkbox", { name: "Image Captioning" })).toBeChecked();
    await expect(captioningSelect).toHaveValue(captionConnection.id);
  } finally {
    await Promise.all([
      request.delete(`/api/connections/${chatConnection.id}`).catch(() => undefined),
      request.delete(`/api/connections/${captionConnection.id}`).catch(() => undefined),
    ]);
  }
});

test("Connection Discard uses the configured editor accent", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop connection editor guard chrome is covered here.");

  const connectionResponse = await page.request.post("/api/connections", {
    data: {
      name: "Connection Discard Accent",
      provider: "custom",
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  const accentColor = "rgb(20, 184, 166)";

  try {
    await page.goto("/");
    await setAppAccentColor(page, "#14b8a6");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--destructive", "rgb(255, 0, 0)");
    });

    await page.locator('[data-tour="panel-connections"]').click();
    const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
    await rightPanel
      .getByText("Connection Discard Accent", { exact: true })
      .first()
      .evaluate((element) => (element as HTMLElement).click());

    const editor = page.locator(".mari-editor-shell");
    await expect(editor).toBeVisible();
    await editor.locator(".mari-editor-title-input").fill("Connection Discard Accent Edited");
    await editor.locator(".mari-editor-header .mari-editor-action").first().click();

    const discardButton = editor.getByRole("button", { name: "Discard", exact: true });
    await expect(discardButton).toBeVisible();
    await expect(discardButton).toHaveClass(/mari-editor-action--accent/u);
    await expect(discardButton).toHaveCSS("color", accentColor);
    expect(await discardButton.getAttribute("class")).not.toMatch(/destructive|pink|red|rose/iu);
    await discardButton.click();
    await expect(editor).toHaveCount(0);
  } finally {
    await page.request.delete(`/api/connections/${connection.id}`).catch(() => undefined);
  }
});

test("Character favorite tags and stars inherit the configured accent color", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop Character favorite chrome is covered here.");

  const characterName = `Favorite Chroma ${Date.now().toString(36)}`;
  const characterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        extensions: { fav: true },
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const accentColor = "rgb(18, 86, 170)";

  try {
    await page.goto("/");
    await setAppAccentColor(page, "#1256aa");

    await page.locator('[data-tour="panel-characters"]').click();
    const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
    const characterRow = rightPanel.locator('[data-touch-drag-card="character"]').filter({ hasText: characterName });
    await expect(characterRow).toBeVisible();

    const panelStar = characterRow.locator('[data-character-favorite-indicator="panel"]');
    await expect(panelStar).toHaveCSS("color", accentColor);
    expect(await panelStar.getAttribute("class")).not.toMatch(/amber|yellow/iu);

    await characterRow.click();
    const editor = page.locator(".mari-editor-shell");
    const favoriteToggle = editor.locator("[data-character-favorite-toggle]");
    await expect(favoriteToggle).toHaveAttribute("data-favorite", "true");
    await expect(favoriteToggle).toHaveCSS("color", accentColor);
    expect(await favoriteToggle.getAttribute("class")).not.toMatch(/amber|yellow/iu);
    await editor.getByTitle("Back").click();

    await rightPanel.getByRole("button", { name: "Open Characters Library" }).click();
    const library = page.locator('[data-component="CharacterLibraryView"]');
    await library.getByPlaceholder('Search characters or -tag:"tag name"').fill(characterName);

    const cardFavorite = library.locator('[data-character-favorite-indicator="card"]');
    const detailFavorite = library.locator('[data-character-favorite-indicator="detail"]:visible');
    const surfaceAccentColor = await readCssVariableColor(page, "--marinara-chat-chrome-button-text-active");
    for (const indicator of [cardFavorite, detailFavorite]) {
      await expect(indicator).toBeVisible();
      await expect(indicator).toHaveClass(/mari-chrome-accent-surface/u);
      await expect(indicator).toHaveCSS("color", surfaceAccentColor);
      expect(await indicator.getAttribute("class")).not.toMatch(/amber|yellow/iu);
    }
  } finally {
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("Characters can be dragged from the right panel into the active chat", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "HTML resource dragging is covered on desktop.");

  const suffix = Date.now().toString(36);
  const characterName = `Chat Drop Character ${suffix}`;
  const characterResponse = await request.post("/api/characters", {
    data: { data: { name: characterName } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: { name: `Chat Drop ${suffix}`, mode: "conversation", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.goto("/");
    await page.evaluate(async (chatId) => {
      const module = await import("/src/stores/chat.store.ts");
      module.useChatStore.getState().setActiveChatId(chatId);
    }, chat.id);
    const dropSurface = page.locator('[data-chat-resource-drop-surface]');
    await expect(dropSurface).toBeVisible();

    await page.locator('[data-tour="panel-characters"]').click();
    const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
    const characterRow = rightPanel.locator('[data-touch-drag-card="character"]').filter({ hasText: characterName });
    await expect(characterRow).toBeVisible();

    await dragChatResource(page, characterRow, dropSurface);

    await expect.poll(() => getChatCharacterIds(request, chat.id)).toContain(character.id);
  } finally {
    await Promise.all([
      request.delete(`/api/chats/${chat.id}`).catch(() => undefined),
      request.delete(`/api/characters/${character.id}`).catch(() => undefined),
    ]);
  }
});

test("Character row actions can add a resource to the active chat without dragging", async ({ page, request }) => {
  const suffix = Date.now().toString(36);
  const characterName = `Chat Action Character ${suffix}`;
  const characterResponse = await request.post("/api/characters", {
    data: { data: { name: characterName } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: { name: `Chat Action ${suffix}`, mode: "conversation", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.goto("/");
    await page.evaluate(async (chatId) => {
      const module = await import("/src/stores/chat.store.ts");
      module.useChatStore.getState().setActiveChatId(chatId);
    }, chat.id);
    await expect(page.locator('[data-chat-resource-drop-surface]')).toBeVisible();
    await page.locator('[data-tour="panel-characters"]').click();

    const characterRow = page.locator('[data-touch-drag-card="character"]').filter({ hasText: characterName });
    const addAction = characterRow.locator('[data-chat-resource-action="character"]');
    await expect(addAction).toBeVisible();
    await addAction.click();

    await expect.poll(() => getChatCharacterIds(request, chat.id)).toContain(character.id);
    await expect(characterRow.locator('[data-chat-resource-action="character"]')).toHaveCount(0);
  } finally {
    await Promise.all([
      request.delete(`/api/chats/${chat.id}`).catch(() => undefined),
      request.delete(`/api/characters/${character.id}`).catch(() => undefined),
    ]);
  }
});

test("Dropping a persona confirms before replacing the active chat persona", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "HTML resource dragging is covered on desktop.");

  const suffix = Date.now().toString(36);
  const currentResponse = await request.post("/api/characters/personas", {
    data: { name: `Current Drop Persona ${suffix}` },
  });
  const nextResponse = await request.post("/api/characters/personas", {
    data: { name: `Next Drop Persona ${suffix}` },
  });
  expect(currentResponse.ok()).toBeTruthy();
  expect(nextResponse.ok()).toBeTruthy();
  const currentPersona = (await currentResponse.json()) as { id: string; name: string };
  const nextPersona = (await nextResponse.json()) as { id: string; name: string };
  const chatResponse = await request.post("/api/chats", {
    data: { name: `Persona Drop ${suffix}`, mode: "roleplay", characterIds: [], personaId: currentPersona.id },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.goto("/");
    await page.evaluate(async (chatId) => {
      const module = await import("/src/stores/chat.store.ts");
      module.useChatStore.getState().setActiveChatId(chatId);
    }, chat.id);
    await expect(page.locator('[data-chat-resource-drop-surface]')).toBeVisible();
    await page.locator('[data-tour="panel-personas"]').click();
    const personaRow = page.locator('[data-touch-drag-card="persona"]').filter({ hasText: nextPersona.name });
    const dropSurface = page.locator('[data-chat-resource-drop-surface]');
    await expect(personaRow).toBeVisible();

    await dragChatResource(page, personaRow, dropSurface);
    const dialog = page.getByRole("dialog", { name: "Replace chat persona?" });
    await expect(dialog).toContainText(currentPersona.name);
    await expect(dialog).toContainText(nextPersona.name);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(((await (await request.get(`/api/chats/${chat.id}`)).json()) as { personaId: string }).personaId).toBe(
      currentPersona.id,
    );

    await dragChatResource(page, personaRow, dropSurface);
    await page
      .getByRole("dialog", { name: "Replace chat persona?" })
      .getByRole("button", { name: "Replace", exact: true })
      .click();
    await expect
      .poll(async () => ((await (await request.get(`/api/chats/${chat.id}`)).json()) as { personaId: string }).personaId)
      .toBe(nextPersona.id);
  } finally {
    await Promise.all([
      request.delete(`/api/chats/${chat.id}`).catch(() => undefined),
      request.delete(`/api/characters/personas/${currentPersona.id}`).catch(() => undefined),
      request.delete(`/api/characters/personas/${nextPersona.id}`).catch(() => undefined),
    ]);
  }
});

test("Character Chat actions reuse mode selection and seed the chosen setup wizard", async ({
  page,
  request,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const characterName = `Character Chat Launcher ${suffix}`;
  const characterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        first_mes: `Hello from ${characterName}.`,
        tags: [`Launcher ${suffix}`, "Responsive", "No overlap"],
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const createdChatIds = new Set<string>();
  const createdCharacterIds = new Set([character.id]);
  let createdGroupId: string | null = null;
  const mobile = testInfo.project.name.includes("mobile");
  const rightPanel = page.locator(`[data-component="${mobile ? "RightPanelMobile" : "RightPanelDesktop"}"]`);

  const readActiveChatId = () =>
    page.evaluate(async () => {
      const module = await import("/src/stores/chat.store.ts");
      return module.useChatStore.getState().activeChatId;
    });
  const readButtonTypography = (button: Locator) =>
    button.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        lineHeight: style.lineHeight,
      };
    });

  const expectModeSelector = async () => {
    const selector = page.locator('[data-component="ChatModeSelectorModal"]');
    await expect(selector).toBeVisible();
    await expect(selector.getByRole("button", { name: /^Conversation/u })).toBeVisible();
    await expect(selector.getByRole("button", { name: /^Roleplay/u })).toBeVisible();
    await expect(selector.getByRole("button", { name: /^Game/u })).toBeVisible();
    return selector;
  };

  const ensureCharacterPanelOpen = async () => {
    if (!(await rightPanel.isVisible())) {
      await page.locator('[data-tour="panel-characters"]').click();
    }
    await expect(rightPanel).toBeVisible();
  };

  try {
    await page.goto("/");
    await ensureCharacterPanelOpen();

    await rightPanel.getByRole("button", { name: "Open Characters Library" }).click();
    const library = page.locator('[data-component="CharacterLibraryView"]');
    await library.getByPlaceholder('Search characters or -tag:"tag name"').fill(characterName);
    const editCharacter = library.getByRole("button", { name: "Edit Character", exact: true });
    const chatNow = library.getByRole("button", { name: "Chat Now", exact: true });
    await expect(editCharacter).toBeVisible();
    await expect(chatNow).toBeVisible();
    await expect(editCharacter).toHaveCSS("font-weight", "400");
    await expect(chatNow).toHaveCSS("font-weight", "400");
    expect(await readButtonTypography(chatNow)).toEqual(await readButtonTypography(editCharacter));
    await chatNow.click();

    const libraryModeSelector = await expectModeSelector();
    await libraryModeSelector.getByRole("button", { name: /^Game/u }).click();
    await expect.poll(readActiveChatId).not.toBeNull();
    const gameChatId = await readActiveChatId();
    expect(gameChatId).not.toBeNull();
    createdChatIds.add(gameChatId!);

    const gameWizard = page.locator('[data-component="GameSetupWizard"]');
    await expect(gameWizard).toBeVisible();
    await gameWizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(gameWizard.getByRole("heading", { name: "World", exact: true })).toBeVisible();
    await gameWizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(gameWizard.getByRole("heading", { name: "Party", exact: true })).toBeVisible();
    await expect(gameWizard.getByText(characterName, { exact: true }).first()).toBeVisible();
    await gameWizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await expect(gameWizard).toHaveCount(0);

    await ensureCharacterPanelOpen();
    const characterRow = rightPanel.locator(`[data-touch-drag-card="character"][data-character-id="${character.id}"]`);
    await expect(characterRow).toBeVisible();
    if (!mobile) await characterRow.hover();

    const actions = characterRow.locator("[data-character-row-actions]");
    await expect(actions).toBeVisible();
    const duplicateButton = actions.getByRole("button", { name: "Duplicate", exact: true });
    const deleteButton = actions.getByRole("button", { name: "Delete", exact: true });
    const chatButton = actions.getByRole("button", {
      name: `Start a new chat with ${characterName}`,
      exact: true,
    });
    await duplicateButton.click();
    const copiedCharacterRow = rightPanel
      .locator('[data-touch-drag-card="character"]')
      .filter({ hasText: `${characterName} (Copy)` });
    await expect(copiedCharacterRow).toBeVisible();
    await expect(copiedCharacterRow).toHaveCSS("animation-name", "none");
    await expect(characterRow).toHaveCSS("flex-shrink", "0");
    await expect(copiedCharacterRow).toHaveCSS("flex-shrink", "0");
    const copiedCharacterId = await copiedCharacterRow.getAttribute("data-character-id");
    expect(copiedCharacterId).toBeTruthy();
    createdCharacterIds.add(copiedCharacterId!);
    if (!mobile) await characterRow.hover();

    const [originalRowBox, copiedRowBox, originalNameBox, originalTagsBox, copiedNameBox, copiedTagsBox] =
      await Promise.all([
        characterRow.boundingBox(),
        copiedCharacterRow.boundingBox(),
        characterRow.locator("[data-character-row-name]").boundingBox(),
        characterRow.locator("[data-character-row-tags]").boundingBox(),
        copiedCharacterRow.locator("[data-character-row-name]").boundingBox(),
        copiedCharacterRow.locator("[data-character-row-tags]").boundingBox(),
      ]);
    expect(originalRowBox).not.toBeNull();
    expect(copiedRowBox).not.toBeNull();
    expect(originalNameBox).not.toBeNull();
    expect(originalTagsBox).not.toBeNull();
    expect(copiedNameBox).not.toBeNull();
    expect(copiedTagsBox).not.toBeNull();
    const orderedRowBoxes = [originalRowBox!, copiedRowBox!].sort((left, right) => left.y - right.y);
    expect(orderedRowBoxes[0].y + orderedRowBoxes[0].height).toBeLessThanOrEqual(orderedRowBoxes[1].y);
    expect(originalNameBox!.y + originalNameBox!.height).toBeLessThanOrEqual(originalTagsBox!.y);
    expect(copiedNameBox!.y + copiedNameBox!.height).toBeLessThanOrEqual(copiedTagsBox!.y);
    expect(originalTagsBox!.y + originalTagsBox!.height).toBeLessThanOrEqual(
      originalRowBox!.y + originalRowBox!.height,
    );
    expect(copiedTagsBox!.y + copiedTagsBox!.height).toBeLessThanOrEqual(copiedRowBox!.y + copiedRowBox!.height);

    const [duplicateBox, deleteBox, chatBox, duplicateIconBox, deleteIconBox, chatIconBox] = await Promise.all([
      duplicateButton.boundingBox(),
      deleteButton.boundingBox(),
      chatButton.boundingBox(),
      duplicateButton.locator("svg").boundingBox(),
      deleteButton.locator("svg").boundingBox(),
      chatButton.locator("svg").boundingBox(),
    ]);
    expect(duplicateBox).not.toBeNull();
    expect(deleteBox).not.toBeNull();
    expect(chatBox).not.toBeNull();
    expect(duplicateIconBox).not.toBeNull();
    expect(deleteIconBox).not.toBeNull();
    expect(chatIconBox).not.toBeNull();
    expect(Math.abs(duplicateBox!.height - deleteBox!.height)).toBeLessThan(0.1);
    expect(Math.abs(duplicateBox!.width - deleteBox!.width)).toBeLessThan(0.1);
    expect(Math.abs(duplicateBox!.height - chatBox!.height)).toBeLessThan(0.1);
    expect(Math.abs(chatBox!.width - (duplicateBox!.width * 3 + 4))).toBeLessThan(0.5);
    expect(duplicateIconBox!.height / duplicateBox!.height).toBeGreaterThan(0.52);
    expect(duplicateIconBox!.width / duplicateBox!.width).toBeGreaterThan(0.52);
    expect(deleteIconBox!.height / deleteBox!.height).toBeGreaterThan(0.52);
    expect(deleteIconBox!.width / deleteBox!.width).toBeGreaterThan(0.52);
    expect(chatIconBox!.height / chatBox!.height).toBeGreaterThan(0.42);
    expect(chatIconBox!.width / chatIconBox!.height).toBeGreaterThan(0.9);
    expect(chatBox!.y).toBeGreaterThan(duplicateBox!.y);

    const folderName = `Character Actions ${suffix}`;
    const groupResponse = await request.post("/api/characters/groups", {
      data: { name: folderName, characterIds: [character.id] },
    });
    expect(groupResponse.ok()).toBeTruthy();
    const group = (await groupResponse.json()) as { id: string };
    createdGroupId = group.id;

    await page.reload();
    await ensureCharacterPanelOpen();
    const folderRow = rightPanel.locator(`[data-character-folder-id="${group.id}"]`);
    await expect(folderRow).toBeVisible();
    const folderHeader = folderRow.locator(':scope > [role="button"]');
    await expect(folderHeader).toBeVisible();
    await expect(folderHeader).toHaveAttribute("aria-expanded", "false");

    await folderHeader.evaluate((element) => (element as HTMLElement).click());
    await expect(folderHeader).toHaveAttribute("aria-expanded", "true", { timeout: 300 });

    if (!mobile) {
      await page.waitForTimeout(400);
      await folderHeader.evaluate((element) => (element as HTMLElement).click());
      await expect(folderHeader).toHaveAttribute("aria-expanded", "false", { timeout: 300 });

      await page.waitForTimeout(400);
      await folderHeader.evaluate((element) => (element as HTMLElement).click());
      await expect(folderHeader).toHaveAttribute("aria-expanded", "true", { timeout: 300 });
    }

    const folderCharacterRow = folderRow.locator('[data-touch-drag-card="character"]').filter({
      hasText: characterName,
    });
    await expect(folderCharacterRow).toBeVisible();

    const folderActions = folderCharacterRow.locator("[data-character-row-actions]");
    const folderActionButtons = folderActions.locator(":scope > button");
    const folderDuplicateButton = folderActionButtons.nth(0);
    const folderDeleteButton = folderActionButtons.nth(1);
    const folderChatButton = folderActionButtons.nth(2);
    const folderRemoveButton = folderActionButtons.nth(3);
    await expect(folderActions).toBeAttached();
    await expect(folderActionButtons).toHaveCount(4);
    await expect(folderDuplicateButton).toHaveAttribute("aria-label", "Duplicate");
    await expect(folderDeleteButton).toHaveAttribute("aria-label", "Delete");
    await expect(folderChatButton).toHaveAttribute("aria-label", `Start a new chat with ${characterName}`);
    await expect(folderRemoveButton).toHaveAttribute("aria-label", "Remove from folder");

    const [folderRowBox, folderActionsBox, ...folderActionBoxes] = await Promise.all([
      folderCharacterRow.boundingBox(),
      folderActions.boundingBox(),
      folderDuplicateButton.boundingBox(),
      folderDeleteButton.boundingBox(),
      folderChatButton.boundingBox(),
      folderRemoveButton.boundingBox(),
    ]);
    expect(folderRowBox).not.toBeNull();
    expect(folderActionsBox).not.toBeNull();
    expect(folderActionBoxes.every((box) => box !== null)).toBeTruthy();
    expect(folderActionsBox!.x + folderActionsBox!.width).toBeLessThanOrEqual(folderRowBox!.x + folderRowBox!.width);
    const folderActionYPositions = folderActionBoxes.map((box) => box!.y);
    expect(Math.max(...folderActionYPositions) - Math.min(...folderActionYPositions)).toBeLessThan(0.1);
    expect(folderActionBoxes.map((box) => box!.x)).toEqual(
      [...folderActionBoxes].map((box) => box!.x).sort((left, right) => left - right),
    );

    await folderChatButton.evaluate((element) => (element as HTMLElement).click());
    const panelModeSelector = await expectModeSelector();
    await panelModeSelector.getByRole("button", { name: /^Roleplay/u }).click();
    await expect.poll(readActiveChatId).not.toBeNull();
    const roleplayChatId = await readActiveChatId();
    expect(roleplayChatId).not.toBeNull();
    createdChatIds.add(roleplayChatId!);

    const roleplayWizard = page.locator('[data-component="ChatSetupWizard"]');
    await expect(roleplayWizard).toBeVisible();
    await roleplayWizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(roleplayWizard.getByRole("heading", { name: "Pick a Preset", exact: true })).toBeVisible();
    await roleplayWizard.getByRole("button", { name: "Next", exact: true }).click();
    const participantsHeading = roleplayWizard.getByRole("heading", {
      name: "Persona & Characters",
      exact: true,
    });
    const presetVariables = page.getByRole("dialog", { name: "Configure Preset Variables" });
    await expect(presetVariables.or(participantsHeading).first()).toBeVisible();
    if (await presetVariables.isVisible()) {
      await presetVariables.getByRole("button", { name: "Skip", exact: true }).click();
    }
    await expect(participantsHeading).toBeVisible();
    await expect(roleplayWizard.getByText(characterName, { exact: true }).first()).toBeVisible();
    await roleplayWizard.getByRole("button", { name: "Close setup", exact: true }).click();
    await expect(roleplayWizard).toHaveCount(0);
  } finally {
    await Promise.all(
      [...createdChatIds].map((chatId) => request.delete(`/api/chats/${chatId}`).catch(() => undefined)),
    );
    if (createdGroupId) {
      await request.delete(`/api/characters/groups/${createdGroupId}`).catch(() => undefined);
    }
    await Promise.all(
      [...createdCharacterIds].map((characterId) =>
        request.delete(`/api/characters/${characterId}`).catch(() => undefined),
      ),
    );
  }
});

test("Character and Persona avatar actions stay separated and visually balanced", async ({ page }) => {
  const suffix = Date.now().toString(36);
  const connectionResponse = await page.request.post("/api/connections", {
    data: {
      name: `Avatar Actions ${suffix}`,
      provider: "image_generation",
      imageGenerationSource: "openai",
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };

  const characterName = `Avatar Character ${suffix}`;
  const characterCreator = "Professor Mari and the Fatui Research Collective";
  const characterVersion = "12.34";
  const characterResponse = await page.request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        creator: characterCreator,
        character_version: characterVersion,
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const characterAvatarResponse = await page.request.post(`/api/characters/${character.id}/avatar`, {
    data: {
      avatar: `data:image/gif;base64,${TRANSPARENT_GIF_BASE64}`,
      filename: "character-avatar.gif",
    },
  });
  expect(characterAvatarResponse.ok()).toBeTruthy();

  const personaName = `Avatar Persona ${suffix}`;
  const personaCreator = "Professor Mari and the Snezhnayan Institute";
  const personaVersion = "56.78";
  const personaResponse = await page.request.post("/api/characters/personas", {
    data: {
      name: personaName,
      creator: personaCreator,
      personaVersion,
    },
  });
  expect(personaResponse.ok()).toBeTruthy();
  const persona = (await personaResponse.json()) as { id: string };
  const personaAvatarResponse = await page.request.post(`/api/characters/personas/${persona.id}/avatar`, {
    data: {
      avatar: `data:image/gif;base64,${TRANSPARENT_GIF_BASE64}`,
      filename: "persona-avatar.gif",
    },
  });
  expect(personaAvatarResponse.ok()).toBeTruthy();

  const verifyEditor = async (
    panel: "characters" | "personas",
    resourceName: string,
    creator: string,
    version: string,
  ) => {
    await page.locator(`[data-tour="panel-${panel}"]`).click();
    await page.getByText(resourceName, { exact: true }).first().click({ position: { x: 2, y: 2 } });

    const editor = page.locator(".mari-editor-shell");
    await expect(editor).toBeVisible();
    const titleLine = editor.locator(".mari-editor-title-line");
    const titleInput = titleLine.locator(".mari-editor-title-input");
    const byline = titleLine.locator(".mari-editor-byline");
    await expect(titleInput).toHaveValue(resourceName);
    await expect(byline).toHaveText(`by ${creator}·v${version}`);
    await expect(editor.locator(".mari-editor-secondary-line .mari-editor-meta")).toHaveCount(0);

    const [titleLineBox, titleInputBox, bylineBox] = await Promise.all([
      titleLine.boundingBox(),
      titleInput.boundingBox(),
      byline.boundingBox(),
    ]);
    expect(titleLineBox).not.toBeNull();
    expect(titleInputBox).not.toBeNull();
    expect(bylineBox).not.toBeNull();
    if (titleLineBox && titleInputBox && bylineBox) {
      expect(titleInputBox.x + titleInputBox.width).toBeLessThanOrEqual(bylineBox.x + 1);
      expect(bylineBox.x + bylineBox.width).toBeLessThanOrEqual(titleLineBox.x + titleLineBox.width + 1);
      expect(Math.abs(titleInputBox.y + titleInputBox.height - (bylineBox.y + bylineBox.height))).toBeLessThanOrEqual(
        2,
      );
    }

    const tile = editor.locator(".mari-editor-avatar-tile");
    const generateButton = tile.getByRole("button", { name: "Generate avatar with AI" });
    const cameraIcon = tile.locator("div.absolute.inset-0 svg");
    await expect(generateButton).toBeVisible();
    await expect(cameraIcon).toHaveCount(1);

    const [tileBox, generateBox, cameraBox] = await Promise.all([
      tile.boundingBox(),
      generateButton.boundingBox(),
      cameraIcon.boundingBox(),
    ]);
    expect(tileBox).not.toBeNull();
    expect(generateBox).not.toBeNull();
    expect(cameraBox).not.toBeNull();
    if (!tileBox || !generateBox || !cameraBox) return;

    expect(generateBox.width).toBeGreaterThanOrEqual(11.5);
    expect(generateBox.width).toBeLessThanOrEqual(14);
    expect(generateBox.x + generateBox.width).toBeLessThanOrEqual(tileBox.x + tileBox.width + 1);
    expect(generateBox.y).toBeGreaterThanOrEqual(tileBox.y - 1);
    const overlapsCamera =
      generateBox.x < cameraBox.x + cameraBox.width &&
      generateBox.x + generateBox.width > cameraBox.x &&
      generateBox.y < cameraBox.y + cameraBox.height &&
      generateBox.y + generateBox.height > cameraBox.y;
    expect(overlapsCamera).toBe(false);

    await editor
      .getByRole("navigation", { name: "Editor sections" })
      .getByRole("button", { name: "Metadata", exact: true })
      .click();
    const uploadButton = editor.getByRole("button", { name: "Upload avatar", exact: true });
    const metadataGenerateButton = editor.getByRole("button", { name: "Generate with AI", exact: true });
    await expect(uploadButton).toBeVisible();
    await expect(metadataGenerateButton).toBeVisible();
    await page.mouse.move(1, 1);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(uploadButton).toHaveClass(/mari-chrome-control--small/);
    await expect(metadataGenerateButton).toHaveClass(/mari-chrome-control--small/);
    const fullImageButton = editor.getByRole("button", { name: "Full image", exact: true });
    const resetCropButton = editor.getByTitle("Reset to centered max-square crop");
    const resetVersionButton = editor.getByTitle("Reset card versioning");
    await expect(fullImageButton).toHaveClass(/mari-editor-action/u);
    await expect(resetCropButton).toHaveClass(/mari-editor-action/u);
    await expect(resetVersionButton).toHaveClass(/mari-editor-action/u);
    await expect(editor.getByText(/^\d+ saved$/u).first()).toHaveClass(/mari-editor-chip--accent/u);

    const touchHoverActive = await metadataGenerateButton.evaluate((element) => element.matches(":hover"));
    if (!touchHoverActive) {
      await expect
        .poll(async () => {
          const [uploadStyles, generateStyles] = await Promise.all(
            [uploadButton, metadataGenerateButton].map((button) =>
              button.evaluate((element) => {
                const styles = getComputedStyle(element);
                return {
                  backgroundColor: styles.backgroundColor,
                  borderColor: styles.borderColor,
                  color: styles.color,
                };
              }),
            ),
          );
          return JSON.stringify(uploadStyles) === JSON.stringify(generateStyles);
        })
        .toBe(true);
    }

    const editorSections = editor.getByRole("navigation", { name: "Editor sections" });
    if (panel === "characters") {
      await editorSections.getByRole("button", { name: "Card", exact: true }).click();
      const addGreetingButton = editor.getByRole("button", { name: "+ Add", exact: true });
      await expect(addGreetingButton).toHaveClass(/mari-editor-action--accent/u);
    }

    await editorSections.getByRole("button", { name: "Lorebook", exact: true }).click();
    await expect(editor.getByRole("button", { name: "New", exact: true })).toHaveClass(/mari-editor-action/u);
    await expect(editor.getByRole("button", { name: "Assign Lorebook", exact: true })).toHaveClass(
      /mari-editor-action--accent/u,
    );

    await editorSections.getByRole("button", { name: "Colors", exact: true }).click();
    await expect(editor.getByRole("button", { name: "Extract Colors from Avatar", exact: true })).toHaveClass(
      /mari-editor-action--accent/u,
    );

    await editor
      .locator(".mari-editor-header .mari-editor-action")
      .first()
      .evaluate((button: HTMLButtonElement) => button.click());
    await expect(editor).toHaveCount(0);
  };

  try {
    await page.goto("/");
    await verifyEditor("characters", characterName, characterCreator, characterVersion);
    await verifyEditor("personas", personaName, personaCreator, personaVersion);
  } finally {
    await Promise.all([
      page.request.delete(`/api/characters/${character.id}`).catch(() => undefined),
      page.request.delete(`/api/characters/personas/${persona.id}`).catch(() => undefined),
      page.request.delete(`/api/connections/${connection.id}`).catch(() => undefined),
    ]);
  }
});

test("Matched full-body sprites approve a neutral anchor before using portrait references", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "The matched sprite approval workflow is covered on desktop.");

  const suffix = Date.now().toString(36);
  const characterName = `Matched Full Body ${suffix}`;
  const connectionResponse = await request.post("/api/connections", {
    data: {
      name: `Matched Full Body ${suffix}`,
      provider: "image_generation",
      imageGenerationSource: "openai",
      model: "gpt-image-2",
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };

  const characterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        description: "A brown-haired gentleman in a dark formal coat and polished black shoes.",
        extensions: {
          appearance: "brown hair, red eyes, dark formal coat, waistcoat, tailored trousers, polished black shoes",
        },
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };

  for (const expression of ["neutral", "happy"]) {
    const spriteResponse = await request.post(`/api/sprites/${character.id}`, {
      data: {
        expression,
        image: `data:image/gif;base64,${TRANSPARENT_GIF_BASE64}`,
      },
    });
    expect(spriteResponse.ok()).toBeTruthy();
  }

  const promptPreviewResponse = await request.post("/api/sprites/generate-sheet/preview", {
    data: {
      connectionId: connection.id,
      appearance: "brown hair, red eyes, dark formal coat, waistcoat, tailored trousers, polished black shoes",
      expressions: ["neutral"],
      cols: 1,
      rows: 1,
      spriteType: "full-body",
      fullBodyExpressionMode: true,
      nativeTransparentPng: true,
      noBackground: true,
    },
  });
  expect(promptPreviewResponse.ok()).toBeTruthy();
  const promptPreview = (await promptPreviewResponse.json()) as {
    items?: Array<{ prompt?: string; negativePrompt?: string }>;
  };
  expect(promptPreview.items?.[0]?.prompt).toMatch(/flat, uniform chroma green #00FF00/iu);
  expect(promptPreview.items?.[0]?.prompt).toMatch(/never a painted transparency checkerboard/iu);
  expect(promptPreview.items?.[0]?.prompt).not.toMatch(/transparent PNG format/iu);
  expect(promptPreview.items?.[0]?.negativePrompt).toMatch(/checkerboard background/iu);

  const generationRequests: Array<{
    expressions?: string[];
    expressionReferences?: Array<{ expression?: string; image?: string }>;
    neutralFullBodyReference?: string;
    nativeTransparentPng?: boolean;
    noBackground?: boolean;
  }> = [];
  await page.route("**/api/sprites/generate-sheet", async (route) => {
    const body = route.request().postDataJSON() as (typeof generationRequests)[number];
    generationRequests.push(body);
    const expression = body.expressions?.[0] ?? "neutral";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sheetBase64: "",
        cells: [{ expression, base64: TRANSPARENT_GIF_BASE64 }],
      }),
    });
  });

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-characters"]').click();
    const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
    await rightPanel.locator('[data-touch-drag-card="character"]').filter({ hasText: characterName }).click();

    const editor = page.locator(".mari-editor-shell");
    await editor
      .getByRole("navigation", { name: "Editor sections" })
      .getByRole("button", { name: "Sprites", exact: true })
      .click();
    await editor.getByRole("button", { name: "Full-body", exact: true }).click();
    await editor.getByRole("button", { name: "Generate Sprite", exact: true }).click();

    const modal = page.getByRole("dialog", { name: "Generate Sprites" });
    await expect(modal).toBeVisible();
    await expect(modal.getByRole("checkbox", { name: "Transparent sprite background" })).toBeChecked();
    await modal.getByRole("checkbox", { name: "Match existing expression sprites" }).check();
    await modal.getByRole("button", { name: "Generate Matched Sprites" }).click();

    await expect(modal.getByText("Approve the neutral full-body design", { exact: true })).toBeVisible();
    await expect.poll(() => generationRequests.length).toBe(1);
    expect(generationRequests[0]).toMatchObject({
      expressions: ["neutral"],
      nativeTransparentPng: true,
      noBackground: true,
    });
    expect(generationRequests[0]?.expressionReferences).toEqual([
      {
        expression: "neutral",
        image: expect.stringContaining(`/api/sprites/${character.id}/file/`),
      },
    ]);

    await modal.getByRole("button", { name: "Use neutral and continue" }).click();
    await expect.poll(() => generationRequests.length).toBe(2);
    expect(generationRequests[1]).toMatchObject({
      expressions: ["happy"],
      nativeTransparentPng: true,
      noBackground: true,
      neutralFullBodyReference: expect.stringMatching(/^data:image\/png;base64,/u),
    });
    expect(generationRequests[1]?.expressionReferences).toEqual([
      {
        expression: "happy",
        image: expect.stringContaining(`/api/sprites/${character.id}/file/`),
      },
    ]);
    await expect(modal.locator('input[value="happy"]')).toBeVisible();
  } finally {
    await page.unroute("**/api/sprites/generate-sheet");
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
    await request.delete(`/api/connections/${connection.id}`).catch(() => undefined);
  }
});

test("Convo About Me keeps manual editing and native expanded-editor keyboard behavior", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The shared Convo profile fields are covered on desktop.");

  const characterName = "About Me Controls Smoke";
  const createResponse = await page.request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        personality: "Dryly funny and observant.",
        extensions: { aboutMe: "alpha\nbeta" },
      },
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const character = (await createResponse.json()) as { id: string };

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-characters"]').click();
    await page.getByText(characterName, { exact: true }).first().click();

    const editorSections = page.getByRole("navigation", { name: "Editor sections" });
    await editorSections.getByRole("button", { name: "Convo", exact: true }).click();

    const fields = page.locator('[data-component="ConvoProfileFields"]');
    await expect(fields.getByText("About Me", { exact: true })).toBeVisible();
    const aboutMe = fields.locator("textarea").first();
    await expect(aboutMe).toHaveValue("alpha\nbeta");
    await expect(fields.getByRole("button", { name: "AI Write", exact: true })).toHaveCount(0);
    await expect(fields.getByRole("button", { name: "AI Write sources", exact: true })).toHaveCount(0);
    await expect(fields.locator("select")).toHaveCount(1);

    await aboutMe.evaluate((textarea) => {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
    });
    await page.keyboard.press("Tab");
    await expect(aboutMe).toHaveValue("  alpha\n  beta");
    await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+z`);
    await expect(aboutMe).toHaveValue("alpha\nbeta");

    await fields.getByRole("button", { name: "Expand editor", exact: true }).first().click();
    const expandedEditor = page.locator('[data-component="ExpandedMacroEditor"] textarea');
    await expect(expandedEditor).toHaveValue("alpha\nbeta");

    await expandedEditor.evaluate((textarea) => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    });
    await page.keyboard.type("!");
    await expect(expandedEditor).toHaveValue("alpha\nbeta!");
    await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+z`);
    await expect(expandedEditor).toHaveValue("alpha\nbeta");

    await expandedEditor.evaluate((textarea) => {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
    });
    await page.keyboard.press("Tab");
    await expect(expandedEditor).toHaveValue("  alpha\n  beta");
    await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+z`);
    await expect(expandedEditor).toHaveValue("alpha\nbeta");

    await expandedEditor.evaluate((textarea) => {
      textarea.focus();
      textarea.setSelectionRange(0, textarea.value.length);
    });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(expandedEditor).toHaveValue("alpha\nbeta");
  } finally {
    await page.request.delete(`/api/characters/${character.id}`);
  }
});

test("Conversation membership notices begin only after the chat starts", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Conversation membership regression is covered on desktop.");

  const createCharacter = async (name: string) => {
    const response = await request.post("/api/characters", {
      data: { data: { name, first_mes: `Hello from ${name}.` } },
    });
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as { id: string };
  };

  const firstCharacter = await createCharacter("Greeting Seed One");
  const secondCharacter = await createCharacter("Greeting Seed Two");
  const thirdCharacter = await createCharacter("Later Join Three");
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Conversation Membership Smoke", mode: "conversation", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const initialAssignment = await request.patch(`/api/chats/${chat.id}`, {
      data: { characterIds: [firstCharacter.id] },
    });
    expect(initialAssignment.ok()).toBeTruthy();
    const messagesAfterSetup = (await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{
      role: string;
      content: string;
    }>;
    expect(messagesAfterSetup).toEqual([]);

    const laterAssignment = await request.patch(`/api/chats/${chat.id}`, {
      data: { characterIds: [firstCharacter.id, secondCharacter.id] },
    });
    expect(laterAssignment.ok()).toBeTruthy();
    const messagesAfterSetupChanges = (await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{
      role: string;
      content: string;
    }>;
    expect(messagesAfterSetupChanges).toEqual([]);

    const finishSetup = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { conversationSetupComplete: true },
    });
    expect(finishSetup.ok()).toBeTruthy();

    const postStartAssignment = await request.patch(`/api/chats/${chat.id}`, {
      data: { characterIds: [firstCharacter.id, secondCharacter.id, thirdCharacter.id] },
    });
    expect(postStartAssignment.ok()).toBeTruthy();
    const messagesAfterLaterJoin = (await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as Array<{
      role: string;
      content: string;
    }>;
    expect(messagesAfterLaterJoin).toHaveLength(1);
    expect(messagesAfterLaterJoin[0]).toMatchObject({
      role: "system",
      content: "Later Join Three has joined the chat.",
    });
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/characters/${firstCharacter.id}`);
    await request.delete(`/api/characters/${secondCharacter.id}`);
    await request.delete(`/api/characters/${thirdCharacter.id}`);
  }
});

test("character schedules export the live draft and import safely", async ({ page, request }) => {
  const suffix = Date.now().toString(36);
  const characterName = `Schedule Transfer ${suffix}`;
  const characterResponse = await request.post("/api/characters", {
    data: { data: { name: characterName, first_mes: "Good morning." } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: { name: `Schedule Transfer ${suffix}`, mode: "conversation", characterIds: [character.id] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const emptyDays = () => ({
    Monday: [] as Array<{ time: string; activity: string; status: string }>,
    Tuesday: [] as Array<{ time: string; activity: string; status: string }>,
    Wednesday: [] as Array<{ time: string; activity: string; status: string }>,
    Thursday: [] as Array<{ time: string; activity: string; status: string }>,
    Friday: [] as Array<{ time: string; activity: string; status: string }>,
    Saturday: [] as Array<{ time: string; activity: string; status: string }>,
    Sunday: [] as Array<{ time: string; activity: string; status: string }>,
  });
  const originalSchedule = {
    weekStart: "2026-07-20T00:00:00.000Z",
    days: {
      ...emptyDays(),
      Monday: [{ time: "09:00-17:00", activity: "Original research", status: "dnd" }],
    },
    inactivityThresholdMinutes: 120,
    autonomousDailyCapOverride: null,
    routineSummary: "An exacting weekly routine.",
    routineSummaryGeneratedAt: "2026-07-20T12:00:00.000Z",
    disabledAutonomousIntents: [],
    talkativeness: 50,
  };
  const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: {
      conversationSetupComplete: true,
      conversationSchedulesEnabled: true,
      characterSchedules: { [character.id]: originalSchedule },
    },
  });
  expect(metadataResponse.ok()).toBeTruthy();

  const storedSchedule = async () => {
    const response = await request.get(`/api/chats/${chat.id}`);
    const stored = (await response.json()) as { metadata: string | Record<string, unknown> };
    const metadata =
      typeof stored.metadata === "string"
        ? (JSON.parse(stored.metadata) as Record<string, unknown>)
        : stored.metadata;
    return (metadata.characterSchedules as Record<string, typeof originalSchedule>)[character.id];
  };
  const openScheduleEditor = async () => {
    const drawer = page.locator(".mari-chat-settings-drawer");
    if (!(await drawer.isVisible())) {
      const settingsButton = page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true });
      if ((page.viewportSize()?.width ?? 0) < 768) {
        await page.getByRole("button", { name: "More options", exact: true }).click();
      }
      await settingsButton.click();
    }
    await expect(drawer).toBeVisible();
    const section = drawer.locator('[data-chat-settings-section="conversation-autonomous-messaging"]');
    const sectionHeader = section.locator('[role="button"][aria-expanded]').first();
    if ((await sectionHeader.getAttribute("aria-expanded")) !== "true") await sectionHeader.click();
    await section.getByRole("button").filter({ hasText: characterName }).click();
    const dialog = page.getByRole("dialog", { name: `Edit ${characterName} Schedule` });
    await expect(dialog).toBeVisible();
    return dialog;
  };
  const expandMonday = async (dialog: Locator) => {
    const monday = dialog.locator("section").filter({ hasText: /^Monday/ }).first();
    await monday.getByRole("button").first().click();
    return dialog.getByLabel("Monday block activity");
  };

  await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
  try {
    await page.goto("/");
    let dialog = await openScheduleEditor();
    let activity = await expandMonday(dialog);
    await activity.fill("Unsaved export draft");

    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Export schedule", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`${characterName.replaceAll(" ", "_")}.marinara-schedule.json`);
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const exported = JSON.parse(readFileSync(downloadPath!, "utf8")) as {
      kind: string;
      version: number;
      schedule: typeof originalSchedule;
    };
    expect(exported.kind).toBe("marinara.character-schedule");
    expect(exported.version).toBe(1);
    expect(exported.schedule.days.Monday[0]?.activity).toBe("Unsaved export draft");

    const fileInput = dialog.locator('input[type="file"][accept*=".json"]');
    await fileInput.setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from("{}") });
    await expect(page.getByText("That file does not contain a valid character schedule.", { exact: true })).toBeVisible();
    await expect(activity).toHaveValue("Unsaved export draft");
    await fileInput.setInputFiles({
      name: "oversized.json",
      mimeType: "application/json",
      buffer: Buffer.alloc(1024 * 1024 + 1, 0x20),
    });
    await expect(page.getByText("Schedule files must be smaller than 1 MB.", { exact: true })).toBeVisible();
    await expect(activity).toHaveValue("Unsaved export draft");

    const importedSchedule = {
      ...originalSchedule,
      days: {
        ...emptyDays(),
        Monday: [{ time: "10:00-18:00", activity: "Imported current format", status: "online" }],
      },
      inactivityThresholdMinutes: 75,
      talkativeness: 70,
    };
    await fileInput.setInputFiles({
      name: "current.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ kind: "marinara.character-schedule", version: 1, schedule: importedSchedule }),
      ),
    });
    await expect(page.getByText("Schedule imported as an unsaved draft.", { exact: true })).toBeVisible();
    await expect(activity).toHaveValue("Imported current format");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect.poll(async () => (await storedSchedule()).days.Monday[0]?.activity).toBe("Original research");

    dialog = await openScheduleEditor();
    activity = await expandMonday(dialog);
    await expect(activity).toHaveValue("Original research");
    const legacySchedule = {
      ...originalSchedule,
      days: {
        ...emptyDays(),
        Monday: [{ time: "11:00-19:00", activity: "Imported legacy format", status: "idle" }],
      },
      talkativeness: 90,
    };
    await dialog.locator('input[type="file"][accept*=".json"]').setInputFiles({
      name: "legacy.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(legacySchedule)),
    });
    await expect(activity).toHaveValue("Imported legacy format");
    await dialog.getByRole("button", { name: "Save schedule", exact: true }).click();
    await expect.poll(async () => (await storedSchedule()).days.Monday[0]?.activity).toBe("Imported legacy format");
    expect((await storedSchedule()).talkativeness).toBe(90);
  } finally {
    await Promise.allSettled([
      request.delete(`/api/chats/${chat.id}`),
      request.delete(`/api/characters/${character.id}`),
    ]);
  }
});

test("provider concurrency errors appear in generation toasts", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Generation error toast regression is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Provider Concurrency Toast Smoke",
      mode: "roleplay",
      characterIds: [],
      connectionId: "concurrency-test-connection",
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.route("**/api/generate", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "Provider concurrency limit exceeded for this account" }),
      });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");
    await page.locator("textarea.mari-chat-input-textarea").fill("Test the provider limit");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(
      page.getByText(
        "The provider's concurrency limit was reached. Wait for another generation to finish, then try again. Provider message: Provider concurrency limit exceeded for this account",
      ),
    ).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("sent text stays cleared and the first message edit persists after stopped generation", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Stopped-generation edit persistence is covered on desktop.");
  test.setTimeout(90_000);

  const suffix = Date.now().toString(36);
  const providerRequests: Array<Record<string, unknown>> = [];
  const openProviderResponses = new Set<import("node:http").ServerResponse>();
  const providerServer = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    incoming.on("end", () => {
      if (incoming.method !== "POST" || incoming.url !== "/v1/chat/completions") {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "Unexpected stopped-generation provider request" }));
        return;
      }
      providerRequests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
      openProviderResponses.add(response);
      response.on("close", () => openProviderResponses.delete(response));
      response.writeHead(200, {
        "content-type": "text/event-stream",
        connection: "keep-alive",
        "cache-control": "no-cache",
      });
      response.flushHeaders();
      if (providerRequests.length <= 2) {
        response.write(
          `data: ${JSON.stringify({
            choices: [{ index: 0, delta: { content: "Partial response" }, finish_reason: null }],
          })}\n\n`,
        );
      }
    });
  });
  await new Promise<void>((resolve) => providerServer.listen(0, "127.0.0.1", resolve));

  let connectionId = "";
  let characterId = "";
  let chatId = "";
  try {
    const address = providerServer.address();
    if (!address || typeof address === "string") throw new Error("Stopped-generation provider fixture did not bind");

    const connectionResponse = await request.post("/api/connections", {
      data: {
        name: `Stopped Edit Provider ${suffix}`,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "e2e-stopped-edit",
        model: "stopped-edit-model",
        maxContext: 32_768,
      },
    });
    expect(connectionResponse.ok(), await connectionResponse.text()).toBeTruthy();
    connectionId = ((await connectionResponse.json()) as { id: string }).id;

    const characterResponse = await request.post("/api/characters", {
      data: {
        data: {
          name: `Stopped Edit Character ${suffix}`,
          description: "A patient regression-test partner.",
          first_mes: "",
        },
      },
    });
    expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
    characterId = ((await characterResponse.json()) as { id: string }).id;

    const chatResponse = await request.post("/api/chats", {
      data: {
        name: `Stopped Edit Chat ${suffix}`,
        mode: "roleplay",
        characterIds: [characterId],
        connectionId,
      },
    });
    expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
    chatId = ((await chatResponse.json()) as { id: string }).id;
    await request.patch(`/api/chats/${chatId}/metadata`, {
      data: { enableAgents: false },
    });
    await page.addInitScript((activeChatId) => localStorage.setItem("marinara-active-chat-id", activeChatId), chatId);
    await page.goto("/");

    const input = page.locator("textarea.mari-chat-input-textarea");
    const sendButton = page.locator("button.mari-chat-send-btn");
    const stopCurrentGeneration = async (expectedProviderRequestCount: number) => {
      await expect.poll(() => providerRequests.length).toBe(expectedProviderRequestCount);
      await expect(sendButton.locator("svg.lucide-circle-stop")).toBeVisible();
      await sendButton.click();
      await expect(sendButton.locator("svg.lucide-circle-stop")).toHaveCount(0);
    };
    const readMessages = async () => {
      const response = await request.get(`/api/chats/${chatId}/messages`);
      return (await response.json()) as Array<{ id: string; role: string; content: string }>;
    };
    const editMessageOnce = async (messageId: string, nextContent: string) => {
      const message = page.locator(`[data-message-id="${messageId}"]`);
      await message.hover();
      await message.getByTitle("Edit", { exact: true }).click();
      const editor = message.locator("textarea");
      await editor.fill(nextContent);
      await message.getByLabel("Save edit", { exact: true }).click();
      await expect(message).toContainText(nextContent);
      await expect
        .poll(async () => (await readMessages()).find((candidate) => candidate.id === messageId)?.content)
        .toBe(nextContent);
    };

    await input.fill("Original message with retained draft");
    await sendButton.click();
    await expect(input).toHaveValue("");
    await input.fill("Unsent composer text");
    await stopCurrentGeneration(1);
    const firstMessage = (await readMessages()).find(
      (message) => message.role === "user" && message.content === "Original message with retained draft",
    );
    expect(firstMessage).toBeTruthy();
    await editMessageOnce(firstMessage!.id, "Edited on the first save with retained draft");
    await expect(input).toHaveValue("Unsent composer text");

    await input.fill("Original message with cleared draft");
    await sendButton.click();
    await expect(input).toHaveValue("");
    await stopCurrentGeneration(2);
    await expect(input).toHaveValue("");
    const secondMessage = (await readMessages()).find(
      (message) => message.role === "user" && message.content === "Original message with cleared draft",
    );
    expect(secondMessage).toBeTruthy();
    await editMessageOnce(secondMessage!.id, "Edited on the first save with cleared draft");

    await input.fill("Sent text must stay cleared when stopped before the reply");
    await sendButton.click();
    await expect(input).toHaveValue("");
    await stopCurrentGeneration(3);
    await expect(input).toHaveValue("");
    await expect
      .poll(async () =>
        (await readMessages()).some(
          (message) =>
            message.role === "user" && message.content === "Sent text must stay cleared when stopped before the reply",
        ),
      )
      .toBe(true);

    await page.reload();
    await expect(page.locator(`[data-message-id="${firstMessage!.id}"]`)).toContainText(
      "Edited on the first save with retained draft",
    );
    await expect(page.locator(`[data-message-id="${secondMessage!.id}"]`)).toContainText(
      "Edited on the first save with cleared draft",
    );
    await expect(
      page.getByText("Sent text must stay cleared when stopped before the reply", { exact: true }),
    ).toBeVisible();
  } finally {
    for (const response of openProviderResponses) response.end();
    await Promise.allSettled([
      chatId ? request.delete(`/api/chats/${chatId}`) : Promise.resolve(),
      characterId ? request.delete(`/api/characters/${characterId}`) : Promise.resolve(),
      connectionId ? request.delete(`/api/connections/${connectionId}`) : Promise.resolve(),
    ]);
    await new Promise<void>((resolve, reject) => {
      providerServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("empty focused chat composers keep keyboard swipe navigation", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Keyboard swipe navigation is covered on desktop.");

  const chatResponse = await request.post("/api/chats", {
    data: { name: "Focused Composer Swipe Navigation", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
    data: { role: "assistant", content: "First focused-composer swipe." },
  });
  expect(messageResponse.ok()).toBeTruthy();
  const message = (await messageResponse.json()) as { id: string };
  const swipeResponse = await request.post(`/api/chats/${chat.id}/messages/${message.id}/swipes`, {
    data: { content: "Second focused-composer swipe.", silent: true },
  });
  expect(swipeResponse.ok()).toBeTruthy();

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            intuitiveSwipeNavigation: true,
            intuitiveSwipeRerollLatest: false,
          },
          version: 87,
        }),
      );
    }, chat.id);
    await page.goto("/");

    const composer = page.locator("textarea.mari-chat-input-textarea");
    const messageRow = page.locator(`[data-message-id="${message.id}"]`);
    await expect(messageRow).toContainText("First focused-composer swipe.");

    await composer.focus();
    await expect(composer).toHaveValue("");
    await composer.press("ArrowRight");
    await expect(messageRow).toContainText("Second focused-composer swipe.");

    await composer.fill("Do not navigate while I am typing");
    await composer.press("ArrowLeft");
    await expect(messageRow).toContainText("Second focused-composer swipe.");

    await composer.fill("");
    await composer.press("ArrowLeft");
    await expect(messageRow).toContainText("First focused-composer swipe.");
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("typographic quotes do not pull the Roleplay caret behind later text", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Roleplay quote caret behavior is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Roleplay Quote Caret Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.addInitScript((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{},"version":65}') as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.hasCompletedOnboarding = true;
      persisted.state.quoteFormat = "typographic";
      localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    const input = page.locator("textarea.mari-chat-input-textarea");
    const waitForDelayedSelectionRestores = () =>
      input.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );

    await input.focus();
    await page.keyboard.type("wasn't");
    await waitForDelayedSelectionRestores();

    await expect(input).toHaveValue("wasn’t");
    await expect.poll(() => input.evaluate((element) => element.selectionStart)).toBe(6);
    await expect.poll(() => input.evaluate((element) => element.selectionEnd)).toBe(6);

    await input.fill("");
    await input.focus();
    await page.keyboard.type('"t');
    await waitForDelayedSelectionRestores();

    await expect(input).toHaveValue("“t");
    await expect.poll(() => input.evaluate((element) => element.selectionStart)).toBe(2);
    await expect.poll(() => input.evaluate((element) => element.selectionEnd)).toBe(2);
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("desktop Roleplay composition keeps ambient work off the input path and grows before paint", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop composer performance is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Roleplay Composer Performance Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.addInitScript((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{},"version":87}') as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.hasCompletedOnboarding = true;
      persisted.state.appAccentPulseMode = true;
      localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    const input = page.locator("textarea.mari-chat-input-textarea");
    const root = page.locator("html");
    await expect(input).toHaveAttribute("spellcheck", "true");
    await expect(input).not.toHaveAttribute("data-lt-active");
    await expect(root).toHaveAttribute("data-marinara-accent-animation");

    await page.evaluate(() => {
      const measurementWindow = window as Window & { __lastKeyboardOpen?: boolean };
      window.addEventListener("marinara:chat-visual-viewport-change", (event) => {
        measurementWindow.__lastKeyboardOpen = (event as CustomEvent<{ keyboardOpen?: boolean }>).detail?.keyboardOpen;
      });
    });
    await page.setViewportSize({ width: 1440, height: 700 });
    await input.focus();

    await expect
      .poll(() => page.evaluate(() => (window as Window & { __lastKeyboardOpen?: boolean }).__lastKeyboardOpen))
      .toBe(false);
    await expect(root).not.toHaveAttribute("data-marinara-accent-animation");

    const initialHeight = await input.evaluate((element) => {
      element.style.flex = "0 0 240px";
      element.style.width = "240px";
      return element.clientHeight;
    });
    await input.evaluate((element) => {
      const value =
        "A long Roleplay sentence should wrap onto another line without briefly hiding the newly typed text.";
      element.value = value;
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: value,
          inputType: "insertText",
        }),
      );
    });
    const wrappedHeight = await input.evaluate(
      (element) =>
        new Promise<number>((resolve) => {
          requestAnimationFrame(() => resolve(element.clientHeight));
        }),
    );
    expect(wrappedHeight).toBeGreaterThan(initialHeight);

    const resizeStability = await input.evaluate(
      (element) =>
        new Promise<{ heightDelta: number; delayedStyleMutations: number; overflowY: string }>((resolve) => {
          const heights: number[] = [];
          let delayedStyleMutations = 0;
          const observer = new MutationObserver((records) => {
            delayedStyleMutations += records.length;
          });
          observer.observe(element, { attributes: true, attributeFilter: ["style"] });

          const sample = () => {
            heights.push(element.getBoundingClientRect().height);
            if (heights.length < 18) {
              requestAnimationFrame(sample);
              return;
            }
            observer.disconnect();
            resolve({
              heightDelta: Math.max(...heights) - Math.min(...heights),
              delayedStyleMutations,
              overflowY: element.style.overflowY,
            });
          };
          requestAnimationFrame(sample);
        }),
    );
    expect(resizeStability.heightDelta).toBeLessThanOrEqual(1);
    expect(resizeStability.delayedStyleMutations).toBe(0);
    expect(resizeStability.overflowY).toBe("hidden");

    await input.blur();
    await expect(root).toHaveAttribute("data-marinara-accent-animation");
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("desktop Echo Chamber commits its resized dimensions before reload", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop Echo Chamber resizing is covered on desktop.");

  await page.route("**/api/app-settings/ui", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { value: null } });
      return;
    }
    const body = route.request().postDataJSON() as { value?: unknown } | null;
    await route.fulfill({ json: { value: typeof body?.value === "string" ? body.value : "" } });
  });

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Echo Chamber Size Persistence Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: true, activeAgentIds: ["echo-chamber"] },
    });
    expect(metadataResponse.ok()).toBeTruthy();

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.addInitScript((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{},"version":87}') as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.hasCompletedOnboarding = true;
      persisted.state.echoChamberOpen = true;
      persisted.state.echoChamberSide = "bottom-right";
      localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    const resizeHandle = page.getByRole("button", { name: "Resize Echo Chamber" });
    await expect(resizeHandle).toBeVisible();
    const panel = resizeHandle.locator("..");
    const initialBox = await panel.boundingBox();
    expect(initialBox).not.toBeNull();

    await resizeHandle.press("ArrowRight");
    await resizeHandle.press("ArrowDown");

    const savedSize = await page.evaluate((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
        state?: {
          echoChamberSizeByChatId?: Record<string, { width?: unknown; height?: unknown }>;
        };
      };
      return persisted.state?.echoChamberSizeByChatId?.[chatId] ?? null;
    }, chat.id);
    expect(savedSize).not.toBeNull();
    expect(savedSize?.width).toBeGreaterThan(Math.round(initialBox!.width));
    expect(savedSize?.height).toBeGreaterThan(Math.round(initialBox!.height));

    await page.reload();
    const restoredHandle = page.getByRole("button", { name: "Resize Echo Chamber" });
    await expect(restoredHandle).toBeVisible();
    const restoredBox = await restoredHandle.locator("..").boundingBox();
    expect(restoredBox).not.toBeNull();
    expect(Math.abs(restoredBox!.width - Number(savedSize?.width))).toBeLessThanOrEqual(1);
    expect(Math.abs(restoredBox!.height - Number(savedSize?.height))).toBeLessThanOrEqual(1);
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("mobile Roleplay composition avoids draft rewrites and pauses ambient rendering", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile composer resource behavior is covered on mobile.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Mobile Composition Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.addInitScript((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{},"version":87}') as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.hasCompletedOnboarding = true;
      persisted.state.quoteFormat = "typographic";
      localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    const input = page.locator("textarea.mari-chat-input-textarea");
    await input.evaluate((element) => {
      element.value = 'She said "';
      element.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          data: '"',
          inputType: "insertCompositionText",
          isComposing: true,
        }),
      );
    });

    await expect(input).toHaveValue('She said "');
    await expect(page.locator('[data-chat-mode="roleplay"]')).toHaveClass(/mari-generation-render-paused/u);

    await input.fill("");
    await input.blur();
    await expect(page.locator('[data-chat-mode="roleplay"]')).not.toHaveClass(/mari-generation-render-paused/u);
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("held Roleplay deletion defers draft persistence and autosizing until a release boundary", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Held-key composer behavior is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Held Delete Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.addInitScript((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{},"version":87}') as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.hasCompletedOnboarding = true;
      localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    const input = page.locator("textarea.mari-chat-input-textarea");
    const initialValue =
      "The sustained deletion regression keeps this Roleplay draft long enough to exercise textarea autosizing.";
    await input.fill(initialValue);

    const readPersistedDraft = () =>
      page.evaluate((chatId) => {
        const entries = JSON.parse(localStorage.getItem("marinara-input-drafts") ?? "[]") as Array<[string, string]>;
        return new Map(entries).get(chatId) ?? "";
      }, chat.id);
    await expect.poll(readPersistedDraft).toBe(initialValue);

    await input.evaluate((element) => {
      const measurementWindow = window as Window & { __heldDeleteStyleMutations?: number };
      measurementWindow.__heldDeleteStyleMutations = 0;
      new MutationObserver((records) => {
        measurementWindow.__heldDeleteStyleMutations =
          (measurementWindow.__heldDeleteStyleMutations ?? 0) +
          records.filter((record) => record.attributeName === "style").length;
      }).observe(element, { attributes: true, attributeFilter: ["style"] });
    });

    await input.focus();
    await page.keyboard.down("Backspace");
    await page.waitForTimeout(520);

    await expect(input).toHaveValue(initialValue.slice(0, -1));
    expect(await readPersistedDraft()).toBe(initialValue);
    expect(
      await page.evaluate(
        () => (window as Window & { __heldDeleteStyleMutations?: number }).__heldDeleteStyleMutations ?? 0,
      ),
    ).toBe(0);

    await page.keyboard.up("Backspace");
    await expect.poll(readPersistedDraft).toBe(initialValue.slice(0, -1));
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { __heldDeleteStyleMutations?: number }).__heldDeleteStyleMutations ?? 0,
        ),
      )
      .toBeGreaterThan(0);

    await input.fill(initialValue);
    await expect.poll(readPersistedDraft).toBe(initialValue);
    await page.evaluate(() => {
      (window as Window & { __heldDeleteStyleMutations?: number }).__heldDeleteStyleMutations = 0;
    });

    await input.focus();
    await page.keyboard.down("Backspace");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));

    await expect(input).toHaveValue(initialValue.slice(0, -1));
    await expect.poll(readPersistedDraft).toBe(initialValue.slice(0, -1));
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as Window & { __heldDeleteStyleMutations?: number }).__heldDeleteStyleMutations ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    await page.keyboard.up("Backspace");
  } finally {
    await page.keyboard.up("Backspace").catch(() => undefined);
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("generation fallbacks identify the replacement connection in a toast", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Fallback toast regression is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Fallback Toast Smoke",
      mode: "roleplay",
      characterIds: [],
      connectionId: "fallback-toast-test-connection",
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.route("**/api/generate", async (route) => {
      const events = [
        {
          type: "fallback_used",
          data: {
            category: "main",
            connectionId: "backup-api",
            connectionName: "Backup API",
            model: "fallback-model",
          },
        },
        { type: "token", data: "Fallback response." },
        { type: "done", data: {} },
      ];
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");
    await page.locator("textarea.mari-chat-input-textarea").fill("Use the fallback if necessary");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(page.getByText("Main switched to Backup API (fallback-model).")).toBeVisible();
    await expect(
      page.getByText("The primary generation failed, so Marinara retried with your configured fallback."),
    ).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

for (const mode of ["roleplay", "conversation"] as const) {
  test(`${mode} exposes reasoning on its first live chunk and retains saved reasoning`, async ({ page }, testInfo) => {
    const characters: Array<{ id: string; name: string }> = [];
    if (mode === "conversation") {
      for (const name of ["Reasoning One", "Reasoning Two"]) {
        const characterResponse = await page.request.post("/api/characters", {
          data: { data: { name } },
        });
        expect(characterResponse.ok()).toBeTruthy();
        characters.push({ id: ((await characterResponse.json()) as { id: string }).id, name });
      }
    }
    const chatResponse = await page.request.post("/api/chats", {
      data: {
        name: `${mode} Reasoning Smoke`,
        mode,
        characterIds: characters.map((character) => character.id),
      },
    });
    expect(chatResponse.ok()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string };

    try {
      if (mode === "conversation") {
        const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
          data: { conversationSetupComplete: true },
        });
        expect(metadataResponse.ok()).toBeTruthy();
      }
      const savedMessageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role: "assistant",
          content:
            mode === "conversation"
              ? `${characters[0]!.name}: A completed response with saved reasoning.`
              : "A completed response with saved reasoning.",
          extra: { thinking: "Saved reasoning remains available." },
        },
      });
      expect(savedMessageResponse.ok()).toBeTruthy();
      const savedMessage = (await savedMessageResponse.json()) as { id: string };

      await page.addInitScript((chatId) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
      }, chat.id);
      await page.goto("/");

      await updateLiveReasoningState(page, chat.id, "start");
      const liveMessageId = mode === "roleplay" ? "__streaming__" : "__conversation_live_stream__";
      const liveMessage = page.locator(`[data-message-id="${liveMessageId}"]`);

      if (mode === "roleplay") {
        await expect(liveMessage).toBeVisible();
        await expect(liveMessage.getByText("Thinking…", { exact: true })).toBeVisible();
      } else {
        await expect(liveMessage).toHaveCount(0);
        await expect(page.locator(".mari-typing-indicator")).toBeVisible();
      }
      await expect(liveMessage.getByRole("button", { name: "View model thoughts" })).toHaveCount(0);

      await updateLiveReasoningState(page, chat.id, "append-thinking", "First reasoning chunk.");
      await expect(liveMessage).toBeVisible();
      const liveThoughtsButton = liveMessage.getByRole("button", { name: "View model thoughts" });
      await expect(liveThoughtsButton).toBeVisible();
      await liveThoughtsButton.click();

      const thoughtsDialog = page.getByRole("dialog", { name: "Model Thoughts" });
      await expect(thoughtsDialog).toBeVisible();
      await expect(thoughtsDialog).toContainText("First reasoning chunk.");

      await updateLiveReasoningState(page, chat.id, "append-thinking", " Second reasoning chunk.");
      await expect(thoughtsDialog).toContainText("First reasoning chunk. Second reasoning chunk.");
      await updateLiveReasoningState(
        page,
        chat.id,
        "append-content",
        mode === "conversation"
          ? `${characters[0]!.name}: The visible response begins.`
          : "The visible response begins.",
      );
      await expect(thoughtsDialog).toBeVisible();
      await expect(thoughtsDialog).toContainText("Second reasoning chunk.");
      await expect(liveMessage.getByRole("button", { name: "View model thoughts" })).toBeVisible();
      const closeThoughtsButton = thoughtsDialog.getByRole("button", { name: "Close Model Thoughts" });
      await expect.poll(() => thoughtsDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Tab");
      await expect(closeThoughtsButton).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(closeThoughtsButton).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(thoughtsDialog).toBeHidden();
      await expect(liveThoughtsButton).toBeFocused();

      await updateLiveReasoningState(page, chat.id, "stop");
      await expect(liveMessage).toHaveCount(0);

      const savedRow = page.locator(`[data-message-id="${savedMessage.id}"]`);
      if (testInfo.project.name.includes("mobile")) {
        await savedRow.click();
      } else {
        await savedRow.hover();
      }
      const savedThoughtsButton = testInfo.project.name.includes("mobile")
        ? savedRow.getByRole("button", { name: "View model thoughts" })
        : savedRow.locator('button[title="View model thoughts"]');
      await expect(savedThoughtsButton).toBeVisible();
      await savedThoughtsButton.click();
      await expect(page.getByRole("dialog", { name: "Model Thoughts" })).toContainText(
        "Saved reasoning remains available.",
      );
    } finally {
      await updateLiveReasoningState(page, chat.id, "stop").catch(() => undefined);
      await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
      await Promise.all(
        characters.map((character) => page.request.delete(`/api/characters/${character.id}`).catch(() => undefined)),
      );
    }
  });
}

test("Roleplay rewrite streaming follows the rendered message height", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Roleplay rewrite scrolling is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Rewrite Scroll Follow Smoke",
      mode: "roleplay",
      characterIds: [],
      connectionId: "rewrite-scroll-test-connection",
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    for (let index = 0; index < 8; index += 1) {
      const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role: index % 2 === 0 ? "user" : "assistant",
          content: `Earlier transcript ${index + 1}. ${"Context keeps this message tall. ".repeat(12)}`,
        },
      });
      expect(messageResponse.ok()).toBeTruthy();
    }

    const originalText = "The short original response.";
    const rewrittenText = Array.from(
      { length: 120 },
      (_, index) => `Rewritten line ${index + 1} keeps unfolding beneath the visible transcript boundary.`,
    ).join("\n");
    const savedMessage = {
      id: "__rewrite_scroll_saved__",
      chatId: chat.id,
      role: "assistant",
      characterId: null,
      content: originalText,
      activeSwipeIndex: 0,
      extra: { postProcessingPending: { agentType: "prose-guardian" } },
      createdAt: new Date().toISOString(),
    };

    await page.route("**/api/generate", async (route) => {
      const events = [
        { type: "token", data: originalText },
        { type: "message_saved", data: savedMessage },
        {
          type: "text_rewrite",
          data: {
            editedText: rewrittenText,
            rewriteApplied: true,
            originalText,
            agentType: "prose-guardian",
          },
        },
        { type: "done", data: {} },
      ];
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      });
    });
    await page.addInitScript((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{},"version":65}') as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.enableStreaming = true;
      persisted.state.streamingSpeed = 90;
      localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    const scroller = page.locator("[data-chat-scroll]");
    await expect(scroller).toBeVisible();
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight))
      .toBeLessThan(12);

    await page.locator("textarea.mari-chat-input-textarea").fill("Rewrite and stream this response");
    await page.locator("button.mari-chat-send-btn").click();
    await expect(page.locator('[data-message-id="__streaming__"]')).toBeVisible();
    const initialScrollTop = await scroller.evaluate((element) => element.scrollTop);

    await expect
      .poll(() => scroller.evaluate((element) => element.scrollTop), { timeout: 15_000 })
      .toBeGreaterThan(initialScrollTop + 80);
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight))
      .toBeLessThan(40);

    await page.locator("button.mari-chat-send-btn").click();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("editing the preceding Roleplay message keeps one live stream row", async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("desktop"),
    "Roleplay edit-during-stream regression is covered on desktop.",
  );

  const chatResponse = await page.request.post("/api/chats", {
    data: {
      name: "Edit During Stream Smoke",
      mode: "roleplay",
      characterIds: [],
      connectionId: "edit-during-stream-test-connection",
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const responseText = Array.from(
      { length: 80 },
      (_, index) => `Streaming line ${index + 1} remains owned by one presentation row.`,
    ).join("\n");
    const savedMessage = {
      id: "__edit_during_stream_saved__",
      chatId: chat.id,
      role: "assistant",
      characterId: null,
      content: responseText,
      activeSwipeIndex: 0,
      extra: {},
      createdAt: new Date().toISOString(),
    };

    await page.route("**/api/generate", async (route) => {
      const events = [
        { type: "token", data: responseText },
        { type: "message_saved", data: savedMessage },
        { type: "agent_start", data: { phase: "post_generation" } },
        {
          type: "agent_result",
          data: {
            agentType: "world-state",
            agentName: "World State",
            resultType: "game_state_update",
            data: {},
            success: true,
            error: null,
            durationMs: 10,
          },
        },
        { type: "done", data: {} },
      ];
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
      });
    });
    await page.addInitScript((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{},"version":65}') as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.enableStreaming = true;
      persisted.state.streamingSpeed = 55;
      localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    await page.locator("textarea.mari-chat-input-textarea").fill("Please answer while I edit this message.");
    await page.locator("button.mari-chat-send-btn").click();

    const liveStream = page.locator('[data-message-id="__streaming__"]');
    const visibleAssistantRows = page.locator('[data-message-role="assistant"]');
    await expect(liveStream).toHaveCount(1);
    await expect(visibleAssistantRows).toHaveCount(1);
    const userMessage = page.locator('[data-message-role="user"]').last();
    await userMessage.hover();
    await userMessage.getByTitle("Edit").click();
    await expect(userMessage.locator("textarea")).toBeVisible();
    await expect(liveStream).toHaveCount(1);
    await expect(visibleAssistantRows).toHaveCount(1);

    await userMessage.getByLabel("Cancel edit").click();
    await expect(userMessage.locator("textarea")).toHaveCount(0);
    await expect(liveStream).toHaveCount(1);
    await expect(visibleAssistantRows).toHaveCount(1);

    await page.locator("button.mari-chat-send-btn").click();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Roleplay side panels synchronize their slide with the desktop shell resize", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop panel animation regression.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Roleplay Panel Performance Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    for (let index = 0; index < 48; index += 1) {
      const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
        data: {
          role: index % 2 === 0 ? "user" : "assistant",
          content: `**Transcript ${index + 1}.** ${"A long roleplay paragraph exercises responsive line wrapping. ".repeat(18)}`,
        },
      });
      expect(messageResponse.ok()).toBeTruthy();
    }

    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");
    const charactersButton = page.getByTitle("Characters");
    await expect(charactersButton).toBeVisible();

    // Exercise the panel over a dense transcript, including its lazy first open.
    await charactersButton.click();
    await expect(page.locator('[data-component="RightPanel"]')).toBeVisible();
    const rightSlot = page.locator('[data-component="RightPanelDesktopSlot"]');
    const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
    const leftSlot = page.locator('[data-component="ChatSidebarSlot"]');
    const leftPanel = page.locator('[data-component="ChatSidebarPanel"]');
    const centerContent = page.locator('[data-component="CenterContent"]');
    await expect(rightPanel).toHaveClass(/mari-shell-panel-enter-right/);
    await rightSlot.evaluate(async (element) => {
      const panel = element.querySelector('[data-component="RightPanelDesktop"]');
      await Promise.all(
        [element, panel]
          .flatMap((target) => target?.getAnimations() ?? [])
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    const openRightSlotWidth = (await rightSlot.boundingBox())?.width ?? 0;
    const openRightPanelX = (await rightPanel.boundingBox())?.x ?? 0;
    const centerWidthWithRightPanel = (await centerContent.boundingBox())?.width ?? 0;
    await page.getByRole("button", { name: "Close panel" }).click();
    await expect(rightPanel).toHaveClass(/mari-shell-panel-exit-right/);
    await expect(rightSlot).not.toHaveCSS("width", "0px");
    await page.waitForTimeout(70);
    const closingRightSlotWidth = (await rightSlot.boundingBox())?.width ?? 0;
    expect(closingRightSlotWidth).toBeGreaterThan(0);
    expect(closingRightSlotWidth).toBeLessThan(openRightSlotWidth);
    expect((await rightPanel.boundingBox())?.x ?? 0).toBeGreaterThan(openRightPanelX + 8);
    expect((await centerContent.boundingBox())?.width ?? 0).toBeGreaterThan(centerWidthWithRightPanel);
    await expect(rightSlot).toHaveCSS("width", "0px");

    await page.locator('[data-tour="sidebar-toggle"]').click();
    await expect(leftSlot).not.toHaveCSS("width", "0px");
    await expect(leftPanel).toHaveClass(/mari-shell-panel-enter-left/);
    await leftSlot.evaluate(async (element) => {
      const panel = element.querySelector('[data-component="ChatSidebarPanel"]');
      await Promise.all(
        [element, panel]
          .flatMap((target) => target?.getAnimations() ?? [])
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    const openLeftSlotWidth = (await leftSlot.boundingBox())?.width ?? 0;
    const openLeftPanelX = (await leftPanel.boundingBox())?.x ?? 0;
    const centerWidthWithLeftPanel = (await centerContent.boundingBox())?.width ?? 0;
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await expect(leftPanel).toHaveClass(/mari-shell-panel-exit-left/);
    await expect(leftSlot).not.toHaveCSS("width", "0px");
    await page.waitForTimeout(70);
    const closingLeftSlotWidth = (await leftSlot.boundingBox())?.width ?? 0;
    expect(closingLeftSlotWidth).toBeGreaterThan(0);
    expect(closingLeftSlotWidth).toBeLessThan(openLeftSlotWidth);
    expect((await leftPanel.boundingBox())?.x ?? 0).toBeLessThan(openLeftPanelX - 8);
    expect((await centerContent.boundingBox())?.width ?? 0).toBeGreaterThan(centerWidthWithLeftPanel);
    await expect(leftSlot).toHaveCSS("width", "0px");

    for (const [slot, panel] of [
      [rightSlot, rightPanel],
      [leftSlot, leftPanel],
    ] as const) {
      const slotTransitions = await slot.evaluate((element) => getComputedStyle(element).transitionProperty);
      const panelTransitions = await panel.evaluate((element) => getComputedStyle(element).transitionProperty);
      expect(slotTransitions.split(",").map((property) => property.trim())).toContain("width");
      expect(panelTransitions.split(",").map((property) => property.trim())).toContain("transform");
      expect(panelTransitions.split(",").map((property) => property.trim())).not.toContain("width");
    }
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("new Roleplay chats seed character Tracker custom-field defaults without reclaiming chat values", async ({
  request,
}) => {
  const suffix = Date.now().toString(36);
  const characterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: `Tracker Defaults ${suffix}`,
        extensions: {
          trackerCustomFieldDefaults: [
            { name: "Mental State", value: "Calm" },
            { name: "Goal", value: "Find the atlas" },
          ],
        },
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const statsOnlyCharacterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: `Tracker Stats ${suffix}`,
        extensions: {
          rpgStats: {
            enabled: true,
            attributes: [],
            hp: { value: 7, max: 10 },
            pools: [{ name: "Resolve", value: 7, max: 10, color: "#60a5fa" }],
          },
        },
      },
    },
  });
  expect(statsOnlyCharacterResponse.ok()).toBeTruthy();
  const statsOnlyCharacter = (await statsOnlyCharacterResponse.json()) as { id: string };
  const chatIds: string[] = [];

  try {
    const createChat = async () => {
      const response = await request.post("/api/chats", {
        data: {
          name: `Tracker Defaults ${suffix}`,
          mode: "roleplay",
          characterIds: [character.id, statsOnlyCharacter.id],
        },
      });
      expect(response.ok()).toBeTruthy();
      const chat = (await response.json()) as { id: string };
      chatIds.push(chat.id);
      return chat.id;
    };
    const readCharacter = async (chatId: string, characterId = character.id) => {
      const response = await request.get(`/api/chats/${chatId}/game-state`);
      expect(response.ok()).toBeTruthy();
      const state = (await response.json()) as {
        presentCharacters: Array<{
          characterId: string;
          customFields: Record<string, string>;
          stats: Array<{ name: string; value: number; max: number; color: string }>;
        }>;
      };
      return state.presentCharacters.find((entry) => entry.characterId === characterId);
    };

    const firstChatId = await createChat();
    const firstSeed = await readCharacter(firstChatId);
    expect(firstSeed?.customFields).toEqual({
      "Mental State": "Calm",
      Goal: "Find the atlas",
    });
    expect((await readCharacter(firstChatId, statsOnlyCharacter.id))?.stats).toEqual([
      { name: "Resolve", value: 7, max: 10, color: "#60a5fa" },
    ]);

    const editedCharacters = [
      {
        ...firstSeed,
        customFields: {
          ...firstSeed?.customFields,
          "Mental State": "Restless",
        },
      },
    ];
    const editResponse = await request.patch(`/api/chats/${firstChatId}/game-state`, {
      data: { presentCharacters: editedCharacters, manual: true },
    });
    expect(editResponse.ok()).toBeTruthy();
    const removeResponse = await request.patch(`/api/chats/${firstChatId}`, {
      data: { characterIds: [statsOnlyCharacter.id] },
    });
    expect(removeResponse.ok()).toBeTruthy();
    const reAddResponse = await request.patch(`/api/chats/${firstChatId}`, {
      data: { characterIds: [character.id, statsOnlyCharacter.id] },
    });
    expect(reAddResponse.ok()).toBeTruthy();
    expect((await readCharacter(firstChatId))?.customFields["Mental State"]).toBe("Restless");

    const secondChatId = await createChat();
    expect((await readCharacter(secondChatId))?.customFields["Mental State"]).toBe("Calm");
  } finally {
    await Promise.all(chatIds.map((chatId) => request.delete(`/api/chats/${chatId}`).catch(() => undefined)));
    await Promise.all(
      [character.id, statsOnlyCharacter.id].map((characterId) =>
        request.delete(`/api/characters/${characterId}`).catch(() => undefined),
      ),
    );
  }
});

test("desktop Tracker stays in the Roleplay gutter without shifting the chat column", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop Tracker gutter behavior is covered on desktop.");

  // Keep this device-local layout test isolated from the shared settings
  // record used by the parallel browser project.
  await page.route("**/api/app-settings/ui", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { value: null } });
      return;
    }
    const body = route.request().postDataJSON() as { value?: unknown } | null;
    await route.fulfill({ json: { value: typeof body?.value === "string" ? body.value : "" } });
  });

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Tracker Gutter Layout Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.setViewportSize({ width: 1200, height: 900 });
    const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: true, activeAgentIds: [] },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    await page.addInitScript((chatId) => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{},"version":65}') as {
        state: Record<string, unknown>;
        version: number;
      };
      persisted.state.trackerPanelEnabled = true;
      persisted.state.trackerPanelOpen = false;
      persisted.state.trackerPanelSide = "left";
      persisted.state.trackerPanelSizeProfile = "expanded";
      persisted.state.trackerPanelHideHudWidgets = false;
      localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    const main = page.locator('[data-component="CenterContent"]');
    const chatColumn = page.locator('[data-roleplay-chat-column="true"]');
    const trackerToggle = page.locator('[data-tracker-panel-toggle="roleplay-hud"]:visible').first();
    await expect(chatColumn).toBeVisible();
    await expect(trackerToggle).toBeVisible();
    const chatColumnBefore = await chatColumn.boundingBox();
    expect(chatColumnBefore).not.toBeNull();

    await trackerToggle.click();
    const tracker = page.locator('[data-component="TrackerDataSidebarDesktop.left"]');
    await expect(tracker).toBeVisible();
    await tracker.evaluate(async (element) => {
      await Promise.all(
        element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)),
      );
    });

    const [mainBox, chatColumnAfter, trackerBox] = await Promise.all([
      main.boundingBox(),
      chatColumn.boundingBox(),
      tracker.boundingBox(),
    ]);
    expect(mainBox).not.toBeNull();
    expect(chatColumnAfter).not.toBeNull();
    expect(trackerBox).not.toBeNull();
    expect(Math.abs(chatColumnAfter!.x - chatColumnBefore!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(chatColumnAfter!.width - chatColumnBefore!.width)).toBeLessThanOrEqual(1);

    const expectedWidth = Math.min(420, Math.floor(chatColumnAfter!.x - mainBox!.x - 8));
    expect(Math.abs(trackerBox!.width - expectedWidth)).toBeLessThanOrEqual(1);
    expect(trackerBox!.x + trackerBox!.width).toBeLessThanOrEqual(chatColumnAfter!.x - 7);

    const trackerContent = tracker.locator(".mari-tracker-panel-scroll");
    const expectedScale = Math.max(0.65, expectedWidth / 420);
    const appliedScale = Number(await trackerContent.getAttribute("data-tracker-content-scale"));
    expect(Math.abs(appliedScale - expectedScale)).toBeLessThanOrEqual(0.001);
    const emptyTrackerText = tracker.getByText("No enabled tracker panels.", { exact: true });
    await expect(emptyTrackerText).toBeVisible();
    const [emptyTextFontSize, rootFontSize] = await emptyTrackerText.evaluate((element) => [
      parseFloat(getComputedStyle(element).fontSize),
      parseFloat(getComputedStyle(document.documentElement).fontSize),
    ]);
    expect(Math.abs(emptyTextFontSize - rootFontSize * 0.6875 * expectedScale)).toBeLessThanOrEqual(0.1);

    const trackerContentBox = await trackerContent.boundingBox();
    expect(trackerContentBox).not.toBeNull();
    expect(trackerContentBox!.x).toBeGreaterThanOrEqual(trackerBox!.x - 1);
    expect(trackerContentBox!.x + trackerContentBox!.width).toBeLessThanOrEqual(trackerBox!.x + trackerBox!.width + 1);

    await tracker.getByRole("button", { name: "Open tracker settings" }).click();
    await expect(tracker.getByRole("toolbar", { name: "Tracker panel settings" })).toBeVisible();
    await tracker.evaluate(async (element) => {
      await Promise.all(
        element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    const horizontalOverflow = await trackerContent.evaluate((root) => {
      let overflow: {
        className: string;
        clientWidth: number;
        depth: number;
        scrollWidth: number;
        tagName: string;
      } | null = null;
      const scan = (node: Element, depth: number) => {
        if (overflow || depth > 6) return;
        const rect = node.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        if (node.scrollWidth > node.clientWidth + 1) {
          overflow = {
            className: node.className,
            clientWidth: node.clientWidth,
            depth,
            scrollWidth: node.scrollWidth,
            tagName: node.tagName,
          };
          return;
        }
        for (let i = 0; i < node.children.length; i++) {
          scan(node.children[i]!, depth + 1);
        }
      };
      scan(root, 0);
      return overflow;
    });
    expect(horizontalOverflow).toBeNull();

    await page.reload();
    await expect(tracker).toBeVisible();

    await tracker.getByRole("button", { name: "Close tracker panel" }).click();
    await expect(tracker).toBeHidden();
    await page.reload();
    await expect(tracker).toBeHidden();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("extension API routes no longer exist", async ({ page }) => {
  const requests = [
    page.request.get("/api/extensions"),
    page.request.post("/api/extensions", { data: { name: "Removed extension" } }),
    page.request.patch("/api/extensions/removed-extension", { data: { enabled: true } }),
    page.request.delete("/api/extensions/removed-extension"),
  ];

  for (const response of await Promise.all(requests)) {
    expect(response.status()).toBe(404);
  }
});

test("legacy browser records are cleaned while extension imports stay locked", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "One browser proves the shared UI-state migration.");

  await page.goto("/");
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
      state: Record<string, unknown>;
      version?: number;
    };
    stored.version = 80;
    stored.state.installedExtensions = [
      {
        id: "legacy-browser-code",
        name: "Legacy browser code",
        description: "Regression fixture",
        js: "globalThis.__marinaraBlockedExtensionMarker = true;",
        enabled: true,
        installedAt: new Date(0).toISOString(),
      },
    ];
    stored.state.hasMigratedExtensionsToServer = false;
    localStorage.setItem("marinara-engine-ui", JSON.stringify(stored));
  });
  await page.reload();

  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
          state: Record<string, unknown>;
          version?: number;
        };
        return {
          version: stored.version,
          hasExtensionRecords: Object.hasOwn(stored.state, "installedExtensions"),
          hasCleanupFlag: Object.hasOwn(stored.state, "hasMigratedExtensionsToServer"),
        };
      }),
    )
    .toEqual({ version: 87, hasExtensionRecords: false, hasCleanupFlag: false });

  expect(
    await page.evaluate(
      () =>
        (globalThis as typeof globalThis & { __marinaraBlockedExtensionMarker?: boolean })
          .__marinaraBlockedExtensionMarker,
    ),
  ).toBeUndefined();

  await page.locator('[data-tour="panel-settings"]').click();
  await page.getByRole("tab", { name: "Addons" }).click();
  await expect(page.getByText("Personal Extensions", { exact: true }).first()).toBeVisible();
  await expect(
    page
      .getByText(
        "Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New Draft" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Import Extension File" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Import Extension Folder" })).toHaveCount(0);
  await expect(page.getByText("External Extensions", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Supported local formats", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Theme Library", { exact: true })).toBeVisible();
  await expect(page.getByText("Legacy Extension Cleanup", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Extensions have been removed/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Import CSS Extension/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Export extension/i })).toHaveCount(0);
});

test("Personal Extensions default to the Professor Mari-only locked workflow", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tour="panel-settings"]').click();
  await page.getByRole("tab", { name: "Addons" }).click();

  await expect(page.getByText("Personal Extensions", { exact: true }).first()).toBeVisible();
  await expect(
    page
      .getByText(
        "Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.",
        { exact: true },
      )
      .first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "New Draft" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Import Extension File" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Import Extension Folder" })).toHaveCount(0);
  await expect(page.getByText("External Extensions", { exact: true })).toHaveCount(0);

  await page.getByRole("tab", { name: "Advanced" }).click();
  const importToggle = page.getByLabel("Allow third-party extension imports");
  const clearAllButton = page.getByRole("button", { name: "Clear All Data" });
  await expect(clearAllButton).toBeVisible();
  await expect(importToggle).toBeDisabled();
  expect(
    await importToggle.evaluate((toggle) => {
      const clearAll = [...document.querySelectorAll("button")].find(
        (button) => button.textContent?.trim() === "Clear All Data",
      );
      return Boolean(clearAll && (clearAll.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
    }),
  ).toBe(true);

  const warning = page.getByText(/Third-party extensions may contain malicious or dangerous code\./u);
  await expect(warning).toBeVisible();
  const warningColors = await warning.evaluate((element) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--primary)";
    document.body.appendChild(probe);
    const result = {
      accent: getComputedStyle(probe).color,
      warning: getComputedStyle(element).color,
    };
    probe.remove();
    return result;
  });
  expect(warningColors.warning).toBe(warningColors.accent);
});

test("external Agent imports require the Danger Zone gate and explicit capabilities", async ({
  page,
  request,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium",
    "This stateful import-policy flow runs once against the shared test server",
  );

  const disabledPolicy = await request.patch("/api/agents/import-policy", { data: { enabled: false } });
  expect(disabledPolicy.ok()).toBeTruthy();

  const testSuffix = Date.now().toString(36);
  const localAgentName = `Locally Authored Agent ${testSuffix}`;
  const importedAgentName = `Permission Review Agent ${testSuffix}`;
  let localAgentId: string | undefined;
  let importedAgentId: string | undefined;
  try {
    const localAgentResponse = await request.post("/api/agents", {
      data: {
        type: `e2e-local-agent-${testSuffix}`,
        name: localAgentName,
        description: "Must remain creatable while external imports are locked.",
        phase: "parallel",
        connectionId: null,
        imagePath: null,
        promptTemplate: "Return a short note.",
        settings: { resultType: "context_injection", customCapabilities: {} },
      },
    });
    expect(localAgentResponse.ok()).toBeTruthy();
    const localAgent = (await localAgentResponse.json()) as { id: string };
    localAgentId = localAgent.id;

    const blockedImport = await request.post("/api/agents/import", {
      data: {
        agent: {
          type: "untrusted-haptic",
          name: "Blocked External Agent",
          description: "",
          phase: "post_processing",
          connectionId: null,
          imagePath: null,
          resultType: "haptic_command",
          promptTemplate: "Return a haptic command.",
          settings: { customCapabilities: { control_haptics: true } },
        },
        source: "file",
        approvedCapabilities: ["control_haptics"],
        acknowledgePermissions: true,
      },
    });
    expect(blockedImport.status()).toBe(403);

    await page.goto("/");
    await page.locator('[data-tour="panel-agents"]').click();
    const disabledHelp = 'Enable "Allow custom Agent imports" in Advanced Settings → Danger Zone first.';
    const lockedImportButton = page.getByTitle(disabledHelp).first();
    await expect(lockedImportButton).toHaveAttribute("aria-disabled", "true");
    await lockedImportButton.dispatchEvent("click");
    await expect(page.getByText(disabledHelp, { exact: true }).last()).toBeVisible();

    await page.locator('[data-tour="panel-settings"]').click();
    await page.getByRole("tab", { name: "Advanced" }).click();
    const agentImportToggle = page.getByLabel("Allow custom Agent imports");
    const extensionImportToggle = page.getByLabel("Allow third-party extension imports");
    await expect(agentImportToggle).toBeEnabled();
    await expect(agentImportToggle).not.toBeChecked();
    expect(
      await agentImportToggle.evaluate((toggle) => {
        const extensionLabel = [...document.querySelectorAll("label")].find(
          (label) => label.textContent?.trim() === "Allow third-party extension imports",
        );
        const extension =
          extensionLabel instanceof HTMLLabelElement ? document.getElementById(extensionLabel.htmlFor) : null;
        return Boolean(
          extension && (toggle.compareDocumentPosition(extension) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        );
      }),
    ).toBe(true);

    const enabledPolicy = await request.patch("/api/agents/import-policy", { data: { enabled: true } });
    expect(enabledPolicy.ok()).toBeTruthy();
    await page.reload();
    await page.locator('[data-tour="panel-agents"]').click();
    const importAgents = page.getByTitle("Import agents");
    await expect(importAgents).toHaveCount(1);
    await expect(importAgents).toHaveAttribute("aria-disabled", "false");
    await expect(page.getByTitle("Import agent folder")).toHaveCount(0);
    await importAgents.click();
    const importSourceDialog = page.getByRole("dialog", { name: "Import agents" });
    await expect(importSourceDialog.getByRole("button", { name: "Choose Files" })).toBeVisible();
    await expect(importSourceDialog.getByRole("button", { name: "Choose Folder" })).toBeVisible();
    await importSourceDialog.getByRole("button", { name: "Cancel" }).click();

    const packageInput = page
      .getByRole("region", { name: "Agents" })
      .locator('input[type="file"][accept*="application/json"]');
    await packageInput.setInputFiles({
      name: "permission-review-agent.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          type: "untrusted-haptic",
          name: importedAgentName,
          description: "Requests haptic control.",
          phase: "post_processing",
          resultType: "haptic_command",
          promptTemplate: "Return a haptic command.",
          settings: { customCapabilities: { control_haptics: true } },
        }),
      ),
    });

    await expect(page.getByRole("dialog", { name: "Review Agent Import Permissions" })).toBeVisible();
    const hapticPermission = page.getByLabel("Control haptic devices");
    await expect(hapticPermission).not.toBeChecked();
    await hapticPermission.check();
    await expect(hapticPermission).toBeChecked();
    await page.getByRole("button", { name: "Approve Permissions and Import" }).click();
    await expect(page.getByRole("dialog", { name: "Review Agent Import Permissions" })).toHaveCount(0);

    const agentsResponse = await request.get("/api/agents");
    expect(agentsResponse.ok()).toBeTruthy();
    const agents = (await agentsResponse.json()) as Array<{ id: string; name: string; settings: string }>;
    const importedAgent = agents.find((agent) => agent.name === importedAgentName);
    expect(importedAgent).toBeTruthy();
    importedAgentId = importedAgent?.id;
    const importedSettings = JSON.parse(importedAgent!.settings) as Record<string, unknown>;
    expect(importedSettings.customAgentImportSource).toBe("file");
    expect(importedSettings.customAgentPermissionsExplicit).toBe(true);
    expect(importedSettings.customCapabilities).toEqual({ control_haptics: true });
  } finally {
    try {
      if (!localAgentId || !importedAgentId) {
        const cleanupAgentsResponse = await request.get("/api/agents").catch(() => null);
        if (cleanupAgentsResponse?.ok()) {
          const cleanupAgents = (await cleanupAgentsResponse.json()) as Array<{ id: string; name: string }>;
          localAgentId ??= cleanupAgents.find((agent) => agent.name === localAgentName)?.id;
          importedAgentId ??= cleanupAgents.find((agent) => agent.name === importedAgentName)?.id;
        }
      }
      await Promise.all([
        localAgentId ? request.delete(`/api/agents/${localAgentId}`).catch(() => undefined) : Promise.resolve(),
        importedAgentId ? request.delete(`/api/agents/${importedAgentId}`).catch(() => undefined) : Promise.resolve(),
      ]);
    } finally {
      await request.patch("/api/agents/import-policy", { data: { enabled: false } });
    }
  }
});

test("Roleplay Active Context shows rich lorebook activation provenance", async ({ page, request }, testInfo) => {
  const lorebookId = "roleplay-active-context-smoke-lorebook";
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Roleplay Active Context Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { activeLorebookIds: [lorebookId] },
  });
  expect(metadataResponse.ok()).toBeTruthy();

  await page.route(`**/api/lorebooks/scan/${chat.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        entries: [
          {
            id: "semantic-entry",
            name: "Whispered Archive",
            content: "The archive answers only to a carefully spoken passphrase.",
            keys: ["archive", "passphrase"],
            lorebookId,
            lorebookName: "Archive Codex",
            activationSources: ["keyword", "semantic"],
            order: 20,
            constant: false,
            selective: false,
            matchedKeys: ["archive"],
            matchType: "semantic",
            semanticScore: 0.864,
          },
          {
            id: "location-entry",
            name: "Northland Bank",
            content: "The bank occupies the northern edge of the square.",
            keys: ["bank"],
            lorebookId,
            lorebookName: "Archive Codex",
            activationSources: ["current_location"],
            order: 10,
            constant: false,
            selective: true,
            matchedKeys: ["bank"],
            matchType: "keyword",
          },
        ],
        budgetSkippedEntries: [
          {
            id: "skipped-entry",
            name: "Sealed Annex",
            lorebookId,
            lorebookName: "Archive Codex",
            matchedKeys: ["annex"],
            activationSources: ["keyword"],
            matchType: "keyword",
            estimatedTokens: 144,
            lorebookBudget: 400,
            lorebookUsedTokens: 360,
            chatBudget: 900,
            chatUsedTokens: 500,
            blockedBy: "lorebook",
          },
        ],
        totalTokens: 321,
        totalEntries: 2,
      }),
    });
  });
  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);

  try {
    await page.goto("/");
    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "More options" }).click();
    }
    await page.locator('button[aria-label="Active Context"]:visible').click();

    const panel = page.locator('[data-component="RoleplayActiveContextPanel"]');
    await expect(panel).toBeVisible();
    await expect.poll(() => panel.evaluate((element) => element.parentElement === document.body)).toBe(true);
    await expect(panel).toHaveCSS("position", "fixed");
    await expect(panel).toHaveCSS("z-index", "9999");
    await expect(panel.getByText("2 active • ~321 tokens", { exact: true })).toBeVisible();
    await expect(panel.getByRole("region", { name: "Current location lore" })).toContainText("Northland Bank");
    await expect(panel.getByText("Whispered Archive", { exact: true })).toBeVisible();
    await expect(panel.getByText("Vector 0.864", { exact: true })).toBeVisible();
    await expect(panel.getByText("Archive Codex · keyword, semantic", { exact: true })).toBeVisible();
    await expect(panel.getByText("Keys: archive, passphrase", { exact: true })).toBeVisible();
    await expect(panel.getByText("Matched: archive", { exact: true })).toBeVisible();

    await panel.getByText("Whispered Archive", { exact: true }).click();
    await expect(
      panel.getByText("The archive answers only to a carefully spoken passphrase.", { exact: true }),
    ).toBeVisible();
    await panel.getByText("1 matching lore entry was skipped by token budget", { exact: true }).click();
    await expect(panel.getByText("Sealed Annex", { exact: true })).toBeVisible();
    await panel.getByText("Sealed Annex", { exact: true }).click();
    await expect(panel.getByText("Budget used before entry: 360 / 400", { exact: true })).toBeVisible();

    const bounds = await panel.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(testInfo.project.use.viewport!.width);
    await testInfo.attach("roleplay-active-context.png", {
      body: await panel.screenshot(),
      contentType: "image/png",
    });
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`, { timeout: 5_000 }).catch(() => undefined);
  }
});

test("chat toolbar panels close when their trigger is clicked again across modes", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop toolbar toggle regression.");

  const roleplayResponse = await request.post("/api/chats", {
    data: { name: "Roleplay Toolbar Toggle Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(roleplayResponse.ok()).toBeTruthy();
  const roleplayChat = (await roleplayResponse.json()) as { id: string };
  const summaryTimestamp = new Date().toISOString();
  const summaryMetadataResponse = await request.patch(`/api/chats/${roleplayChat.id}/metadata`, {
    data: {
      summaryEntries: [
        {
          id: "toolbar-summary-active-1",
          kind: "rolling",
          origin: "manual",
          title: "Active one",
          content: "First active summary.",
          enabled: true,
          sourceMode: "last",
          tokenEstimate: 4,
          createdAt: summaryTimestamp,
          updatedAt: summaryTimestamp,
        },
        {
          id: "toolbar-summary-active-2",
          kind: "rolling",
          origin: "automated",
          title: "Active two",
          content: "Second active summary.",
          enabled: true,
          sourceMode: "last",
          tokenEstimate: 4,
          createdAt: summaryTimestamp,
          updatedAt: summaryTimestamp,
        },
        {
          id: "toolbar-summary-inactive",
          kind: "rolling",
          origin: "manual",
          title: "Inactive",
          content: "Disabled summary.",
          enabled: false,
          sourceMode: "last",
          tokenEstimate: 4,
          createdAt: summaryTimestamp,
          updatedAt: summaryTimestamp,
        },
      ],
    },
  });
  expect(summaryMetadataResponse.ok()).toBeTruthy();
  const conversationResponse = await request.post("/api/chats", {
    data: { name: "Conversation Toolbar Toggle Smoke", mode: "conversation", characterIds: [] },
  });
  expect(conversationResponse.ok()).toBeTruthy();
  const conversationChat = (await conversationResponse.json()) as { id: string };
  const gameResponse = await request.post("/api/chats", {
    data: { name: "Game Toolbar Toggle Smoke", mode: "game", characterIds: [] },
  });
  expect(gameResponse.ok()).toBeTruthy();
  const gameChat = (await gameResponse.json()) as { id: string };
  const gameMetadataResponse = await request.patch(`/api/chats/${gameChat.id}/metadata`, {
    data: {
      gameId: "toolbar-toggle-smoke-game",
      gameSessionStatus: "active",
      gameSessionNumber: 1,
      gameIntroPresented: true,
      enableSpriteGeneration: true,
    },
  });
  expect(gameMetadataResponse.ok()).toBeTruthy();
  const gameMessageResponse = await request.post(`/api/chats/${gameChat.id}/messages`, {
    data: { role: "assistant", content: "The toolbar toggle smoke session begins." },
  });
  expect(gameMessageResponse.ok()).toBeTruthy();

  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, roleplayChat.id);
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "illustrator",
          version: "1.0.0",
          manifest: {
            schemaVersion: 1,
            id: "illustrator",
            name: "Illustrator",
            version: "1.0.0",
            description: "Gallery image generation fixture.",
            engine: { min: "2.0.0", maxExclusive: "3.0.0" },
            kind: ["agent"],
            entrypoints: { agents: "agents.json" },
            files: [{ path: "agents.json", sha256: "0".repeat(64), bytes: 1 }],
            permissions: ["agent-runtime"],
            restartRequired: false,
          },
          installedAt: "2026-01-01T00:00:00.000Z",
          status: "active",
          error: null,
          readiness: "ready",
          readinessError: null,
          legacy: false,
        },
      ]),
    });
  });

  try {
    await page.goto("/");

    const expectSharedDrawerToggles = async (expectGameGenerationActions = false) => {
      const galleryButton = page.getByRole("button", { name: "Gallery", exact: true }).filter({ visible: true });
      await expect(galleryButton).toHaveCount(1);
      await galleryButton.click();
      const galleryDrawer = page.locator(".mari-chat-gallery-drawer");
      await expect(galleryDrawer).toBeVisible();
      if (expectGameGenerationActions) {
        await expect(galleryDrawer.getByRole("button", { name: "Illustrate", exact: true })).toBeVisible();
        await expect(galleryDrawer.getByRole("button", { name: "Background", exact: true })).toBeVisible();
      }
      await galleryButton.click();
      await expect(galleryDrawer).toHaveCount(0);

      const settingsButton = page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true });
      await expect(settingsButton).toHaveCount(1);
      await settingsButton.click();
      await expect(page.locator(".mari-chat-settings-drawer")).toBeVisible();
      await settingsButton.click();
      await expect(page.locator(".mari-chat-settings-drawer")).toHaveCount(0);
    };

    await expectSharedDrawerToggles();

    const summaryButton = page.getByRole("button", { name: "Chat Summary (2 active summaries)", exact: true });
    await expect(summaryButton).toContainText("2");
    await expect(summaryButton).not.toHaveClass(/marinara-chat-toolbar-button--active/);
    const summaryPanel = page.locator("[data-chat-floating-panel]").filter({ hasText: "Chat Summary" });
    await summaryButton.click();
    await expect(summaryPanel).toBeVisible();
    await expect.poll(() => summaryPanel.evaluate((element) => element.parentElement === document.body)).toBe(true);
    await expect(summaryPanel).toHaveCSS("position", "fixed");
    await expect(summaryPanel).toHaveCSS("z-index", "9999");
    await summaryButton.click();
    await expect(summaryPanel).toHaveCount(0);

    const setActiveChat = async (chatId: string) => {
      await page.evaluate(async (nextChatId) => {
        const module = await import("/src/stores/chat.store.ts");
        module.useChatStore.getState().setActiveChatId(nextChatId);
      }, chatId);
    };

    await setActiveChat(conversationChat.id);
    await expectSharedDrawerToggles();
    await setActiveChat(gameChat.id);
    await expectSharedDrawerToggles(true);
  } finally {
    await Promise.all([
      request.delete(`/api/chats/${roleplayChat.id}`),
      request.delete(`/api/chats/${conversationChat.id}`),
      request.delete(`/api/chats/${gameChat.id}`),
    ]);
  }
});

test("roleplay quick preset editor uses chat settings spacing and surfaces", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop Chat Settings compact-editor regression.");

  const suffix = Date.now().toString(36);
  const presetResponse = await request.post("/api/prompts", {
    data: { name: `Quick Preset ${suffix}`, description: "Chat Settings compact-editor fixture." },
  });
  expect(presetResponse.ok()).toBeTruthy();
  const preset = (await presetResponse.json()) as { id: string };
  const sectionResponse = await request.post(`/api/prompts/${preset.id}/sections`, {
    data: {
      identifier: `quick_section_${suffix}`,
      name: "Quick Section",
      content: "Stay concise.",
      role: "system",
    },
  });
  expect(sectionResponse.ok()).toBeTruthy();
  const groupResponse = await request.post(`/api/prompts/${preset.id}/groups`, {
    data: { name: "Quick Group" },
  });
  expect(groupResponse.ok()).toBeTruthy();
  const chatResponse = await request.post("/api/chats", {
    data: {
      name: "Quick Preset Drawer Smoke",
      mode: "roleplay",
      characterIds: [],
      promptPresetId: preset.id,
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);

  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
    const drawer = page.locator(".mari-chat-settings-drawer");
    await expect(drawer).toBeVisible();
    await drawer.getByText("Prompt Preset", { exact: true }).click();

    const quickEditor = drawer.locator(".mari-quick-preset-editor");
    const quickEditorDisclosure = drawer.locator("[data-prompt-preset-quick-editor-disclosure]");
    const quickEditorToggle = quickEditorDisclosure.locator(":scope > button");
    await expect(quickEditor).toBeHidden();
    await expect(quickEditorToggle).toContainText("Edit preset");
    await expect(quickEditorToggle).toHaveAttribute("aria-expanded", "false");

    await quickEditorToggle.click();
    await expect(quickEditor).toBeVisible();
    await expect(quickEditorToggle).toHaveAttribute("aria-expanded", "true");
    await expect(quickEditorToggle).toContainText("Collapse preset editor");
    await expect(drawer.locator('[data-prompt-preset-chevron="select"]')).toBeVisible();

    const toolbar = quickEditor.locator(".mari-editor-toolbar");
    const firstToolbarControl = toolbar.locator("button").first();
    const [toolbarBox, firstToolbarControlBox] = await Promise.all([
      toolbar.boundingBox(),
      firstToolbarControl.boundingBox(),
    ]);
    expect(toolbarBox).not.toBeNull();
    expect(firstToolbarControlBox).not.toBeNull();
    if (toolbarBox && firstToolbarControlBox) {
      expect(firstToolbarControlBox.y - toolbarBox.y).toBeGreaterThanOrEqual(4);
    }

    const sectionCard = quickEditor.locator('[data-touch-reorder-item="preset-section"]').first();
    await expect(sectionCard).toBeVisible();
    await expect
      .poll(() =>
        sectionCard.evaluate((element) => {
          const probe = document.createElement("div");
          probe.style.background = "var(--marinara-chat-chrome-button-bg)";
          element.appendChild(probe);
          const expected = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return getComputedStyle(element).backgroundColor === expected;
        }),
      )
      .toBe(true);

    await drawer.getByRole("button", { name: "Close chat settings", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
    await expect(drawer).toBeVisible();
    await expect(quickEditor).toBeVisible();
    await expect(quickEditorToggle).toHaveAttribute("aria-expanded", "true");
    await expect(quickEditorToggle).toContainText("Collapse preset editor");

    await quickEditorToggle.click();
    await expect(quickEditor).toBeHidden();
    await expect(quickEditorToggle).toHaveAttribute("aria-expanded", "false");
    await expect(quickEditorToggle).toContainText("Edit preset");

    await drawer.getByRole("button", { name: "Close chat settings", exact: true }).click();
    await expect(drawer).toHaveCount(0);
    await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
    await expect(drawer).toBeVisible();
    await expect(quickEditor).toBeHidden();
    await expect(quickEditorToggle).toHaveAttribute("aria-expanded", "false");
  } finally {
    await Promise.all([request.delete(`/api/chats/${chat.id}`), request.delete(`/api/prompts/${preset.id}`)]);
  }
});

test("mobile roleplay quick preset editor keeps marker and metadata controls compact", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile Chat Settings compact-editor regression.");

  const suffix = Date.now().toString(36);
  const presetResponse = await request.post("/api/prompts", {
    data: { name: `Mobile Quick Preset ${suffix}`, description: "Mobile compact-editor fixture." },
  });
  expect(presetResponse.ok()).toBeTruthy();
  const preset = (await presetResponse.json()) as { id: string };
  const groupResponse = await request.post(`/api/prompts/${preset.id}/groups`, {
    data: { name: "Mobile Group" },
  });
  expect(groupResponse.ok()).toBeTruthy();
  const group = (await groupResponse.json()) as { id: string };
  const sectionResponse = await request.post(`/api/prompts/${preset.id}/sections`, {
    data: {
      identifier: `mobile_quick_section_${suffix}`,
      name: "Regular Section",
      content: "Stay concise.",
      role: "system",
    },
  });
  expect(sectionResponse.ok()).toBeTruthy();
  const markerResponse = await request.post(`/api/prompts/${preset.id}/sections`, {
    data: {
      identifier: `mobile_quick_marker_${suffix}`,
      name: "Character Marker",
      content: "",
      role: "system",
      isMarker: true,
      markerConfig: { type: "character" },
      injectionPosition: "ordered",
      groupId: group.id,
    },
  });
  expect(markerResponse.ok()).toBeTruthy();
  const variableResponse = await request.post(`/api/prompts/${preset.id}/variables`, {
    data: {
      variableName: `MOBILE_${suffix}`,
      question: "Choose a mobile option",
      options: [
        { id: `mobile_${suffix}_a`, label: "Option A", value: "value_a" },
        { id: `mobile_${suffix}_b`, label: "Option B", value: "value_b" },
      ],
    },
  });
  expect(variableResponse.ok()).toBeTruthy();
  const chatResponse = await request.post("/api/chats", {
    data: {
      name: "Mobile Quick Preset Drawer Smoke",
      mode: "roleplay",
      characterIds: [],
      promptPresetId: preset.id,
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);

  try {
    await page.goto("/");
    await page.getByRole("button", { name: "More options", exact: true }).click();
    await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
    const drawer = page.locator(".mari-chat-settings-drawer");
    await expect(drawer).toBeVisible();
    await drawer.getByText("Prompt Preset", { exact: true }).click();

    const quickEditor = drawer.locator(".mari-quick-preset-editor");
    const quickEditorToggle = drawer.locator("[data-prompt-preset-quick-editor-disclosure]").locator(":scope > button");
    await expect(quickEditor).toBeHidden();
    await expect(quickEditorToggle).toHaveAttribute("aria-expanded", "false");
    await quickEditorToggle.click();
    await expect(quickEditor).toBeVisible();
    await expect(quickEditorToggle).toHaveAttribute("aria-expanded", "true");
    const markerSection = quickEditor.locator('[data-preset-marker-section="true"]');
    const regularSection = quickEditor.locator('[data-touch-reorder-item="preset-section"]').filter({
      hasText: "Regular Section",
    });
    await expect(markerSection).toBeVisible();
    await expect(markerSection.locator("[data-preset-marker-badge]")).toBeHidden();
    await expect(markerSection.locator("[data-preset-section-group-badge]")).toBeHidden();
    await expect
      .poll(async () => {
        const [markerBackground, regularBackground] = await Promise.all([
          markerSection.evaluate((element) => getComputedStyle(element).backgroundColor),
          regularSection.evaluate((element) => getComputedStyle(element).backgroundColor),
        ]);
        return markerBackground !== regularBackground;
      })
      .toBe(true);

    await markerSection.locator("[data-preset-section-toggle]").click();
    for (const selector of [
      "[data-preset-section-role]",
      "[data-preset-section-position]",
      "[data-preset-section-group]",
    ]) {
      const control = markerSection.locator(selector);
      await expect(control).toBeVisible();
      const controlBox = await control.boundingBox();
      expect(controlBox).not.toBeNull();
      if (controlBox) expect(controlBox.height).toBeLessThanOrEqual(32);
    }
    await expect
      .poll(() => quickEditor.evaluate((element) => element.scrollWidth <= element.clientWidth + 1))
      .toBe(true);

    const variableCount = quickEditor.locator("[data-preset-variable-count]");
    const addVariableButton = quickEditor.getByRole("button", { name: "Add Variable", exact: true });
    const [variableCountBox, addVariableBox] = await Promise.all([
      variableCount.boundingBox(),
      addVariableButton.boundingBox(),
    ]);
    expect(variableCountBox).not.toBeNull();
    expect(addVariableBox).not.toBeNull();
    if (variableCountBox && addVariableBox) {
      const horizontalGap = addVariableBox.x - (variableCountBox.x + variableCountBox.width);
      const wrappedGap = addVariableBox.y - (variableCountBox.y + variableCountBox.height);
      expect(horizontalGap >= 8 || wrappedGap >= 4).toBe(true);
    }
  } finally {
    await Promise.allSettled([request.delete(`/api/chats/${chat.id}`), request.delete(`/api/prompts/${preset.id}`)]);
  }
});

test("Chat Settings edits only the selected cards and lorebook entries inline", async ({ page, request }, testInfo) => {
  const suffix = Date.now().toString(36);
  const characterName = `Inline Character ${suffix}`;
  const personaName = `Inline Persona ${suffix}`;
  const lorebookName = `Inline Lorebook ${suffix}`;
  const characterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        description: "Original character description.",
        personality: "Careful and observant.",
        scenario: "A quiet observatory.",
        first_mes: "This opening must remain unchanged.",
        mes_example: "<START>\n{{char}}: Watch the stars.",
        creator_notes: "",
        system_prompt: "",
        post_history_instructions: "",
        tags: [],
        creator: "",
        character_version: "1.0",
        alternate_greetings: ["The telescope is ready."],
        extensions: {
          talkativeness: 0.5,
          fav: false,
          world: "",
          depth_prompt: { prompt: "", depth: 4, role: "system" },
          backstory: "Raised among astronomers.",
          appearance: "Silver spectacles and an ink-blue coat.",
        },
        character_book: null,
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const unselectedCharacterResponse = await request.post("/api/characters", {
    data: { data: { name: `Unselected Character ${suffix}` } },
  });
  expect(unselectedCharacterResponse.ok()).toBeTruthy();
  const unselectedCharacter = (await unselectedCharacterResponse.json()) as { id: string };
  const personaResponse = await request.post("/api/characters/personas", {
    data: {
      name: personaName,
      description: "Original persona description.",
      personality: "Inquisitive.",
      scenario: "Visiting the observatory.",
      backstory: "A traveling scholar.",
      appearance: "A green traveling cloak.",
    },
  });
  expect(personaResponse.ok()).toBeTruthy();
  const persona = (await personaResponse.json()) as { id: string };
  const lorebookResponse = await request.post("/api/lorebooks", {
    data: {
      name: lorebookName,
      description: "Inline editor fixture.",
      category: "world",
      enabled: true,
    },
  });
  expect(lorebookResponse.ok()).toBeTruthy();
  const lorebook = (await lorebookResponse.json()) as { id: string };
  const firstEntryResponse = await request.post(`/api/lorebooks/${lorebook.id}/entries`, {
    data: {
      name: "Celestial Archive",
      content: "The archive opens at midnight.",
      keys: ["archive"],
      preventRecursion: true,
    },
  });
  expect(firstEntryResponse.ok()).toBeTruthy();
  const firstEntry = (await firstEntryResponse.json()) as { id: string };
  const secondEntryResponse = await request.post(`/api/lorebooks/${lorebook.id}/entries`, {
    data: {
      name: "Northern Telescope",
      content: "The northern telescope tracks comets.",
      keys: ["telescope"],
      preventRecursion: true,
    },
  });
  expect(secondEntryResponse.ok()).toBeTruthy();
  const secondEntry = (await secondEntryResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: {
      name: "Inline Chat Settings Smoke",
      mode: "roleplay",
      characterIds: [character.id],
      personaId: persona.id,
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { activeLorebookIds: [lorebook.id] },
  });
  expect(metadataResponse.ok()).toBeTruthy();

  const detailGetPaths: string[] = [];
  page.on("request", (browserRequest) => {
    if (browserRequest.method() !== "GET") return;
    detailGetPaths.push(new URL(browserRequest.url()).pathname);
  });
  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);

  try {
    await page.goto("/");
    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "More options", exact: true }).click();
    }
    await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
    const drawer = page.locator(".mari-chat-settings-drawer");
    await expect(drawer).toBeVisible();
    expect(detailGetPaths).not.toContain(`/api/characters/${unselectedCharacter.id}`);
    expect(detailGetPaths).not.toContain(`/api/lorebooks/${lorebook.id}/entries`);
    const accentColor = "rgb(20, 184, 166)";
    await setAppAccentColor(page, "#14b8a6");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--destructive", "rgb(255, 0, 0)");
    });

    await drawer.getByText("Persona", { exact: true }).first().click();
    const removePersonaButton = drawer.locator('[data-chat-settings-remove-resource="persona"]');
    await expect(removePersonaButton).toHaveCount(1);
    expect(await removePersonaButton.getAttribute("class")).not.toMatch(/destructive|pink|red|rose/iu);
    if (!testInfo.project.name.includes("mobile")) {
      await removePersonaButton.hover();
      await expect(removePersonaButton).toHaveCSS("color", accentColor);
    }
    await drawer.getByRole("button", { name: "Edit persona card", exact: true }).click();
    const personaEditor = drawer.locator(`[data-chat-settings-inline-card-editor="persona:${persona.id}"]`);
    await expect(personaEditor).toBeVisible();
    expect(detailGetPaths).not.toContain(`/api/characters/${unselectedCharacter.id}`);
    const personaDescription = personaEditor.getByLabel("Description", { exact: true });
    await personaDescription.fill("Updated persona description.");
    await personaEditor.getByLabel("Personality", { exact: true }).focus();
    await expect
      .poll(async () => {
        const response = await request.get(`/api/characters/personas/${persona.id}`);
        const saved = (await response.json()) as { description?: string };
        return saved.description;
      })
      .toBe("Updated persona description.");

    await drawer.getByText("Characters", { exact: true }).first().click();
    const removeCharacterButton = drawer.locator('[data-chat-settings-remove-resource="character"]');
    await expect(removeCharacterButton).toHaveCount(1);
    expect(await removeCharacterButton.getAttribute("class")).not.toMatch(/destructive|pink|red|rose/iu);
    if (!testInfo.project.name.includes("mobile")) {
      await removeCharacterButton.hover();
      await expect(removeCharacterButton).toHaveCSS("color", accentColor);
    }
    await drawer.getByRole("button", { name: "Edit character card", exact: true }).click();
    const characterEditor = drawer.locator(`[data-chat-settings-inline-card-editor="character:${character.id}"]`);
    await expect(characterEditor).toBeVisible();
    await expect(personaEditor).toHaveCount(0);
    expect(detailGetPaths).not.toContain(`/api/characters/${unselectedCharacter.id}`);
    await expect(characterEditor.getByLabel("First Message", { exact: true })).toHaveCount(0);
    await expect
      .poll(() =>
        characterEditor
          .locator("textarea[aria-label]")
          .evaluateAll((textareas) => textareas.map((textarea) => textarea.getAttribute("aria-label"))),
      )
      .toEqual(["Description", "Personality", "Backstory", "Appearance", "Scenario", "Example Dialogue"]);
    await expect(characterEditor.getByLabel("Alternate Greeting #1", { exact: true })).toHaveCount(0);

    await characterEditor.getByRole("button", { name: "Expand Description", exact: true }).click();
    const expandedCardField = page.locator('[data-component="ExpandedTextarea"]');
    await expect(expandedCardField).toBeVisible();
    await expandedCardField.locator("textarea").fill("Updated character description.");
    await expandedCardField.getByRole("button", { name: "Collapse", exact: true }).click();
    await expect
      .poll(async () => {
        const response = await request.get(`/api/characters/${character.id}`);
        const saved = (await response.json()) as { data: string };
        const data = JSON.parse(saved.data) as {
          alternate_greetings?: string[];
          description?: string;
          first_mes?: string;
        };
        return {
          alternateGreetings: data.alternate_greetings,
          description: data.description,
          firstMessage: data.first_mes,
        };
      })
      .toEqual({
        alternateGreetings: ["The telescope is ready."],
        description: "Updated character description.",
        firstMessage: "This opening must remain unchanged.",
      });

    await drawer.getByText("Lorebooks", { exact: true }).first().click();
    expect(detailGetPaths).not.toContain(`/api/lorebooks/${lorebook.id}/entries`);
    await drawer.getByRole("button", { name: "Edit lorebook entries", exact: true }).click();
    const lorebookEditor = drawer.locator(`[data-chat-settings-inline-lorebook-editor="${lorebook.id}"]`);
    await expect(lorebookEditor).toBeVisible();
    await expect
      .poll(() => detailGetPaths.filter((path) => path === `/api/lorebooks/${lorebook.id}/entries`).length)
      .toBe(1);
    const firstEntryRow = lorebookEditor.locator(`[data-lorebook-entry-row-id="${firstEntry.id}"]`);
    const secondEntryRow = lorebookEditor.locator(`[data-lorebook-entry-row-id="${secondEntry.id}"]`);
    await expect(firstEntryRow).toBeVisible();
    await expect(secondEntryRow).toBeVisible();
    await firstEntryRow.getByRole("button", { name: "Expand entry", exact: true }).click();
    await expect(firstEntryRow.locator("textarea")).toHaveCount(2);
    await secondEntryRow.getByRole("button", { name: "Expand entry", exact: true }).click();
    await expect(firstEntryRow.locator("textarea")).toHaveCount(0);
    const secondEntryContent = secondEntryRow.locator("textarea").last();
    await secondEntryContent.fill("The northern telescope now tracks auroras.");
    await secondEntryRow.getByText("Content", { exact: true }).click();
    await expect
      .poll(async () => {
        const response = await request.get(`/api/lorebooks/${lorebook.id}/entries`);
        const saved = (await response.json()) as Array<{ id: string; content: string }>;
        return saved.find((entry) => entry.id === secondEntry.id)?.content;
      })
      .toBe("The northern telescope now tracks auroras.");
    await secondEntryRow.getByRole("button", { name: "Expand editor", exact: true }).last().click();
    await expect(page.locator('[data-component="ExpandedMacroEditor"]')).toBeVisible();
    expect(detailGetPaths).not.toContain(`/api/characters/${unselectedCharacter.id}`);
  } finally {
    await Promise.all([
      request.delete(`/api/chats/${chat.id}`).catch(() => undefined),
      request.delete(`/api/lorebooks/${lorebook.id}`).catch(() => undefined),
      request.delete(`/api/characters/${character.id}`).catch(() => undefined),
      request.delete(`/api/characters/${unselectedCharacter.id}`).catch(() => undefined),
      request.delete(`/api/characters/personas/${persona.id}`).catch(() => undefined),
    ]);
  }
});

test("rewrite shield switches repeatedly between original and rewritten message versions", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Rewrite version toolbar regression is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Rewrite Version Toggle Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const originalText = "The original assistant reply for comparison.";
  const rewrittenText = "The polished rewritten assistant reply for comparison.";

  try {
    const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: rewrittenText,
        extra: {
          proseGuardianOriginalText: originalText,
          proseGuardianRewrittenText: rewrittenText,
          proseGuardianRewrittenAt: new Date().toISOString(),
        },
      },
    });
    expect(messageResponse.ok()).toBeTruthy();

    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    await expect(page.getByText(rewrittenText, { exact: true })).toBeVisible();
    await page.getByText(rewrittenText, { exact: true }).hover();
    await page.getByTitle("Show original before rewrite").click();
    await expect(page.getByText(originalText, { exact: true })).toBeVisible();

    await page.getByText(originalText, { exact: true }).hover();
    await page.getByTitle("Show rewritten version").click();
    await expect(page.getByText(rewrittenText, { exact: true })).toBeVisible();
    await expect(page.getByTitle("Show original before rewrite")).toBeAttached();

    await page.getByText(rewrittenText, { exact: true }).hover();
    await page.getByTitle("Show original before rewrite").click();
    await expect(page.getByText(originalText, { exact: true })).toBeVisible();

    await page.getByText(originalText, { exact: true }).hover();
    await page.getByTitle("Show rewritten version").click();
    await expect(page.getByText(rewrittenText, { exact: true })).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("historical Game Peek Prompt returns the exact selected turn request", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Historical prompt API regression is covered on desktop.");

  const chatResponse = await request.post("/api/chats", {
    data: { name: "Historical Game Prompt Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const firstMessageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: "First game turn",
        extra: {
          cachedPrompt: [
            { role: "system", content: "Exact first system prompt" },
            { role: "user", content: "Exact first player input" },
          ],
          chatSummaryFingerprint: "historical-summary",
          generationInfo: { model: "test-game-model", provider: "custom" },
        },
      },
    });
    expect(firstMessageResponse.ok()).toBeTruthy();
    const firstMessage = (await firstMessageResponse.json()) as { id: string };

    const secondMessageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: "Second game turn",
        extra: {
          cachedPrompt: [{ role: "user", content: "Exact second player input" }],
          generationInfo: { model: "test-game-model", provider: "custom" },
        },
      },
    });
    expect(secondMessageResponse.ok()).toBeTruthy();

    const peekResponse = await request.post(`/api/chats/${chat.id}/peek-prompt`, {
      data: { messageId: firstMessage.id },
    });
    expect(peekResponse.ok()).toBeTruthy();
    const peek = (await peekResponse.json()) as {
      source: string;
      exact: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    expect(peek.source).toBe("cached");
    expect(peek.exact).toBe(true);
    expect(peek.messages).toEqual([
      { role: "system", content: "Exact first system prompt" },
      { role: "user", content: "Exact first player input" },
    ]);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("game widget edits preserve their live numeric values", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Game widget persistence is covered on desktop.");

  const chatResponse = await request.post("/api/chats", {
    data: { name: "Game Widget Value Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const widgets = [
      {
        id: "party-health",
        type: "gauge",
        label: "Party health",
        position: "hud_left",
        config: { startingValue: 20, value: 55, max: 100 },
      },
    ];
    const updateResponse = await request.put(`/api/game/${chat.id}/widgets`, { data: { widgets } });
    expect(updateResponse.ok()).toBeTruthy();

    const storedResponse = await request.get(`/api/chats/${chat.id}`);
    expect(storedResponse.ok()).toBeTruthy();
    const storedChat = (await storedResponse.json()) as { metadata: string | Record<string, unknown> };
    const metadata =
      typeof storedChat.metadata === "string"
        ? (JSON.parse(storedChat.metadata) as Record<string, unknown>)
        : storedChat.metadata;
    const storedWidgets = metadata.gameWidgetState as typeof widgets;
    expect(storedWidgets[0]?.config).toMatchObject({ startingValue: 20, value: 55, max: 100 });
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("Game character sheet Retry remains a draft until Save", async ({ page, request }, testInfo) => {
  const suffix = Date.now().toString(36);
  const characterName = `Retry Sheet Character ${suffix}`;
  const personaName = `Retry Sheet Persona ${suffix}`;
  const personaRpgStats = {
    enabled: true,
    attributes: [{ name: "INT", value: 16 }],
    hp: { value: 18, max: 18 },
    pools: [{ name: "Focus", value: 8, max: 8, color: "#60a5fa" }],
  };
  const originalCard = {
    name: characterName,
    shortDescription: "Original saved sheet.",
    class: "Scout",
    abilities: ["Trail Sense"],
    strengths: ["Patience"],
    weaknesses: ["Deep water"],
    extra: { oath: "Find the tide keys" },
    rpgStats: {
      attributes: [{ name: "WIS", value: 14 }],
      hp: { value: 24, max: 24 },
      pools: [{ name: "HP", value: 24, max: 24, color: "#a78bfa" }],
    },
  };
  const regeneratedCard = {
    name: characterName,
    shortDescription: "A tide-wise scout shaped by the flooded vault.",
    class: "Chronomancer",
    abilities: ["Tide Step", "Read the Lost Hour"],
    strengths: ["Calm under pressure"],
    weaknesses: ["Overextends for the party"],
    extra: { oath: "Recover every tide key" },
    rpgStats: { hp: { value: 1, max: 1 } },
  };
  const providerRequests: Array<Record<string, unknown>> = [];
  const providerServer = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    incoming.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (incoming.method !== "POST" || incoming.url !== "/v1/chat/completions") {
        response.writeHead(404, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "Unexpected test provider request" }));
        return;
      }
      providerRequests.push(JSON.parse(body) as Record<string, unknown>);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          id: `character-sheet-retry-${providerRequests.length}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: "character-sheet-retry-model",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: JSON.stringify(regeneratedCard) },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 80, total_tokens: 180 },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => providerServer.listen(0, "127.0.0.1", resolve));
  let connectionId: string | undefined;
  let characterId: string | undefined;
  let personaId: string | undefined;
  let chatId: string | undefined;

  try {
    const providerAddress = providerServer.address();
    if (!providerAddress || typeof providerAddress === "string") {
      throw new Error("Character sheet retry provider fixture did not bind to a TCP port");
    }
    const connectionResponse = await request.post("/api/connections", {
      data: {
        name: `Character Sheet Retry Provider ${suffix}`,
        provider: "custom",
        baseUrl: `http://127.0.0.1:${providerAddress.port}/v1`,
        apiKey: "e2e-character-sheet-retry",
        model: "character-sheet-retry-model",
        maxContext: 128000,
      },
    });
    expect(connectionResponse.ok()).toBeTruthy();
    const connection = (await connectionResponse.json()) as { id: string };
    connectionId = connection.id;
    const characterResponse = await request.post("/api/characters", {
      data: {
        data: {
          name: characterName,
          description: "A careful scout who reads the weather.",
          personality: "Patient and observant.",
          scenario: "Traveling through a drowned city.",
        },
      },
    });
    expect(characterResponse.ok()).toBeTruthy();
    const character = (await characterResponse.json()) as { id: string };
    characterId = character.id;
    const personaResponse = await request.post("/api/characters/personas", {
      data: {
        name: personaName,
        description: "A memory-weaver who maps the drowned city's forgotten roads.",
        personaStats: JSON.stringify({ rpgStats: personaRpgStats }),
      },
    });
    expect(personaResponse.ok()).toBeTruthy();
    const persona = (await personaResponse.json()) as { id: string };
    personaId = persona.id;

    const chatResponse = await request.post("/api/chats", {
      data: {
        name: `Character Sheet Retry Smoke ${suffix}`,
        mode: "game",
        characterIds: [character.id],
        connectionId: connection.id,
      },
    });
    expect(chatResponse.ok()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string };
    chatId = chat.id;
    const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameId: `character-sheet-retry-${suffix}`,
        gameSessionStatus: "active",
        gameSessionNumber: 1,
        gameIntroPresented: true,
        gamePartyCharacterIds: [character.id],
        gameCharacterCards: [originalCard],
        gameWorldOverview: "A drowned city beneath a glass sea.",
        gameStoryArc: "Recover the seven tide keys before the Leviathan wakes.",
        gamePlotTwists: ["The cartographer serves the Leviathan."],
        gamePreviousSessionSummaries: [
          { sessionNumber: 0, summary: "The party opened the first lock and found a broken tide compass." },
        ],
        gameSetupConfig: {
          genre: "Fantasy",
          setting: "A drowned city beneath a glass sea",
          tone: "Adventurous",
          difficulty: "Normal",
          playerGoals: "Recover the seven tide keys",
          gmMode: "standalone",
          rating: "sfw",
          partyCharacterIds: [character.id],
          language: "English",
        },
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    expect(
      (
        await request.post(`/api/chats/${chat.id}/messages`, {
          data: { role: "assistant", content: "The party reaches the first flooded vault." },
        })
      ).ok(),
    ).toBeTruthy();

    await page.addInitScript(
      ({ activeChatId }) => {
        localStorage.setItem("marinara-active-chat-id", activeChatId);
        const stored = JSON.parse(localStorage.getItem("marinara-engine-ui") || '{"state":{}}') as {
          state?: Record<string, unknown>;
          version?: number;
        };
        localStorage.setItem(
          "marinara-engine-ui",
          JSON.stringify({
            ...stored,
            state: { ...(stored.state ?? {}), gameTutorialDisabled: true },
            version: 82,
          }),
        );
      },
      { activeChatId: chat.id },
    );

    const readStoredCard = async () => {
      const response = await request.get(`/api/chats/${chat.id}`);
      const storedChat = (await response.json()) as { metadata: string | Record<string, unknown> };
      const metadata =
        typeof storedChat.metadata === "string"
          ? (JSON.parse(storedChat.metadata) as Record<string, unknown>)
          : storedChat.metadata;
      return (metadata.gameCharacterCards as Array<Record<string, unknown>>)[0];
    };

    await page.goto("/");
    if (testInfo.project.name.includes("mobile")) {
      await page.getByTitle("Open party members").click();
    }
    await page.getByTitle(`${characterName} - Click to open character sheet`).filter({ visible: true }).click();
    const sheet = page.locator('[data-component="GameCharacterSheet"]');
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Edit sheet" }).click();

    const classInput = sheet.getByPlaceholder("Class or role");
    await expect(classInput).toHaveValue("Scout");
    await sheet.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(classInput).toHaveValue("Chronomancer");
    expect((await readStoredCard())?.class).toBe("Scout");
    await page.mouse.move(0, 0);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);

    await sheet.getByRole("button", { name: "Cancel", exact: true }).click();
    await sheet.getByRole("button", { name: "Edit sheet" }).click();
    await expect(classInput).toHaveValue("Scout");

    await sheet.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(classInput).toHaveValue("Chronomancer");
    await page.mouse.move(0, 0);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    await sheet.getByRole("button", { name: "Save sheet" }).click();
    await expect(page.getByRole("heading", { name: characterName })).toHaveCount(0);
    await expect.poll(async () => (await readStoredCard())?.class).toBe("Chronomancer");
    expect((await readStoredCard())?.rpgStats).toEqual(originalCard.rpgStats);

    const personaRetryResponse = await request.post("/api/game/character-sheet/regenerate", {
      data: {
        chatId: chat.id,
        characterId: `persona:${persona.id}`,
        characterName: personaName,
        connectionId: connection.id,
      },
    });
    expect(personaRetryResponse.ok()).toBeTruthy();
    const personaRetry = (await personaRetryResponse.json()) as {
      gameCard: { rpgStats?: Record<string, unknown> };
    };
    expect(personaRetry.gameCard.rpgStats).toEqual(personaRpgStats);

    expect(providerRequests).toHaveLength(3);
    for (const providerRequest of providerRequests.slice(0, 2)) {
      expect(providerRequest).toMatchObject({
        model: "character-sheet-retry-model",
        stream: false,
      });
      const prompt = JSON.stringify(providerRequest.messages);
      expect(prompt).toContain("A careful scout who reads the weather.");
      expect(prompt).toContain("The party reaches the first flooded vault.");
      expect(prompt).toContain("The party opened the first lock and found a broken tide compass.");
      expect(prompt).toContain(`Regenerate only ${characterName}'s character sheet now.`);
    }
    const personaPrompt = JSON.stringify(providerRequests[2]?.messages);
    expect(personaPrompt).toContain("A memory-weaver who maps the drowned city's forgotten roads.");
    expect(personaPrompt).toContain(`Regenerate only ${personaName}'s character sheet now.`);
  } finally {
    await Promise.all([
      chatId ? request.delete(`/api/chats/${chatId}`).catch(() => undefined) : Promise.resolve(),
      personaId ? request.delete(`/api/characters/personas/${personaId}`).catch(() => undefined) : Promise.resolve(),
      characterId ? request.delete(`/api/characters/${characterId}`).catch(() => undefined) : Promise.resolve(),
      connectionId ? request.delete(`/api/connections/${connectionId}`).catch(() => undefined) : Promise.resolve(),
    ]);
    await new Promise<void>((resolve, reject) => {
      providerServer.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("NPC avatar uploads accept Cyrillic character names", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "NPC avatar upload compatibility is covered on desktop.");

  const chatResponse = await request.post("/api/chats", {
    data: { name: "Unicode NPC Avatar Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const uploadResponse = await request.post(`/api/avatars/npc/${chat.id}`, {
      data: {
        name: "Корвин",
        avatar: `data:image/gif;base64,${TRANSPARENT_GIF_BASE64}`,
      },
    });
    expect(uploadResponse.ok()).toBeTruthy();
    const upload = (await uploadResponse.json()) as { avatarPath: string };
    expect(decodeURIComponent(upload.avatarPath)).toContain("/корвин.gif?");

    const imageResponse = await request.get(upload.avatarPath);
    expect(imageResponse.ok()).toBeTruthy();
    expect(imageResponse.headers()["content-type"]).toBe("image/gif");
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("PocketTTS discovers server voices and uses its speech endpoint", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "PocketTTS routing is covered on desktop.");

  let receivedPath = "";
  let receivedContentType = "";
  let receivedBody = "";
  const pocketTts = createServer((incoming, response) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    incoming.on("end", () => {
      receivedPath = incoming.url ?? "";
      receivedContentType = String(incoming.headers["content-type"] ?? "");
      receivedBody = Buffer.concat(chunks).toString("utf8");
      if (incoming.method === "GET" && incoming.url === "/v1/voices") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            object: "list",
            data: [
              { id: "alba", name: "Alba", object: "voice", type: "builtin" },
              { id: "AgentCobra.wav", name: "Agent Cobra", object: "voice", type: "custom" },
            ],
          }),
        );
        return;
      }
      response.writeHead(200, { "Content-Type": "audio/mpeg" });
      response.end(Buffer.from([0x49, 0x44, 0x33]));
    });
  });
  await new Promise<void>((resolve) => pocketTts.listen(0, "127.0.0.1", resolve));
  let originalConfig: unknown;

  try {
    const address = pocketTts.address();
    if (!address || typeof address === "string") throw new Error("PocketTTS mock did not bind to a TCP port");

    const originalConfigResponse = await request.get("/api/tts/config");
    expect(originalConfigResponse.ok()).toBeTruthy();
    originalConfig = await originalConfigResponse.json();

    const configResponse = await request.put("/api/tts/config", {
      data: {
        enabled: true,
        source: "pockettts",
        baseUrl: `http://127.0.0.1:${address.port}`,
        model: "pocket-tts",
        voice: "alba",
        audioFormat: "mp3",
      },
    });
    expect(configResponse.ok()).toBeTruthy();

    const voicesResponse = await request.get("/api/tts/voices");
    expect(voicesResponse.ok()).toBeTruthy();
    expect(receivedPath).toBe("/v1/voices");
    expect(await voicesResponse.json()).toEqual({
      voices: ["alba", "AgentCobra.wav"],
      voiceOptions: [
        {
          id: "alba",
          name: "Alba",
          description: null,
          previewUrl: null,
          category: "builtin",
          labels: null,
        },
        {
          id: "AgentCobra.wav",
          name: "Agent Cobra",
          description: null,
          previewUrl: null,
          category: "custom",
          labels: null,
        },
      ],
      fromProvider: true,
      source: "pockettts",
    });

    const speechResponse = await request.post("/api/tts/speak", {
      data: { text: "Hello from Marinara." },
    });
    expect(speechResponse.ok()).toBeTruthy();
    expect(receivedPath).toBe("/v1/audio/speech");
    expect(receivedContentType).toContain("application/json");
    expect(JSON.parse(receivedBody)).toMatchObject({
      model: "pocket-tts",
      input: "Hello from Marinara.",
      voice: "alba",
      response_format: "mp3",
      speed: 1,
    });

    const fallbackConfigResponse = await request.put("/api/tts/config", {
      data: {
        enabled: true,
        source: "pockettts",
        baseUrl: `http://127.0.0.1:${address.port}`,
        model: "pocket-tts",
        voice: "",
        audioFormat: "mp3",
      },
    });
    expect(fallbackConfigResponse.ok()).toBeTruthy();

    const fallbackSpeechResponse = await request.post("/api/tts/speak", {
      data: { text: "Use the default PocketTTS voice." },
    });
    expect(fallbackSpeechResponse.ok()).toBeTruthy();
    expect(JSON.parse(receivedBody)).toMatchObject({
      input: "Use the default PocketTTS voice.",
      voice: "alba",
    });

    await page.goto("/");
    await page.locator('[data-tour="panel-connections"]').click();
    const rightPanel = page.locator('[data-component="RightPanel"]');
    await expect(rightPanel).toBeVisible();
    const ttsLabel = rightPanel.getByText("Text to Speech", { exact: true });
    const ttsCard = ttsLabel.locator("xpath=../../..");
    await ttsCard.getByTitle("Expand").click();
    const serverVoiceSelect = ttsCard.getByLabel("PocketTTS server voice");
    await expect(serverVoiceSelect.locator('option[value="AgentCobra.wav"]')).toHaveText(
      "Agent Cobra (AgentCobra.wav)",
    );
    await expect(ttsCard.getByText("Loaded 2 voices from PocketTTS server.", { exact: true })).toBeVisible();

    await ttsCard.getByText("Only read dialogues", { exact: true }).click();
    const dialoguePause = ttsCard.getByLabel("Pause between dialogues in seconds");
    await expect(dialoguePause).toHaveAttribute("min", "1");
    await expect(dialoguePause).toHaveAttribute("max", "60");
    await expect(dialoguePause).toHaveAttribute("step", "1");
    await expect(dialoguePause).toHaveValue("1");
    await expect(ttsCard.getByText("Pause between dialogues: 1 second", { exact: true })).toBeVisible();

    await dialoguePause.fill("60");
    await expect(ttsCard.getByText("Pause between dialogues: 60 seconds", { exact: true })).toBeVisible();
    await expect
      .poll(async () => {
        const response = await request.get("/api/tts/config");
        const config = (await response.json()) as { dialoguePauseMs?: number };
        return config.dialoguePauseMs;
      })
      .toBe(60_000);
  } finally {
    try {
      if (originalConfig !== undefined) await request.put("/api/tts/config", { data: originalConfig });
    } finally {
      await new Promise<void>((resolve, reject) => {
        pocketTts.close((error) => (error ? reject(error) : resolve()));
      });
    }
  }
});

test("OpenAI-compatible TTS accepts and persists a custom Kokoro voice mix", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Custom TTS voice entry is covered on desktop.");

  const configResponse = await page.request.get("/api/tts/config");
  expect(configResponse.ok()).toBeTruthy();
  let mockConfig = {
    ...((await configResponse.json()) as Record<string, unknown>),
    enabled: false,
    source: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "tts-1",
    voice: "alloy",
    voiceMode: "single",
  };
  const kokoroMix = "af_bella(0.5)+af_sarah(0.5)";

  await page.route("**/api/tts/config", async (route) => {
    if (route.request().method() === "PUT") {
      mockConfig = route.request().postDataJSON() as typeof mockConfig;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockConfig),
    });
  });

  await page.goto("/");
  await page.locator('[data-tour="panel-connections"]').click();
  const rightPanel = page.locator('[data-component="RightPanel"]');
  await expect(rightPanel).toBeVisible();
  const ttsCard = rightPanel.getByText("Text to Speech", { exact: true }).locator("xpath=../../..");
  await ttsCard.getByTitle("Expand").click();

  const customVoiceInput = ttsCard.getByTestId("tts-custom-voice-input-global");
  await expect(customVoiceInput).toHaveAttribute("placeholder", /Custom voice or mix/);
  await customVoiceInput.fill(kokoroMix);
  await expect.poll(() => mockConfig.voice).toBe(kokoroMix);
});

test("ElevenLabs keeps models visible and exposes scrollable account voices in every assignment mode", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "ElevenLabs settings are covered on desktop.");

  let voiceFetchCount = 0;
  let saveCount = 0;
  const config = {
    enabled: true,
    source: "elevenlabs",
    baseUrl: "https://api.elevenlabs.io",
    apiKey: "••••••",
    voice: "voice-01",
    model: "eleven_multilingual_v2",
    speed: 1,
    elevenLabsStability: 0.5,
    elevenLabsLanguageCode: "",
    elevenLabsGameSoundEffects: false,
    elevenLabsGameMusic: false,
    voiceMode: "single",
    voiceAssignments: [],
    narratorVoiceEnabled: false,
    narratorVoice: "",
    npcDefaultVoicesEnabled: false,
    npcDefaultMaleVoices: [],
    npcDefaultFemaleVoices: [],
    autoplayRP: false,
    autoplayConvo: false,
    autoplayGame: false,
    progressivePlayback: false,
    dialogueOnly: false,
    dialoguePauseMs: 1000,
    audioFormat: "mp3",
    callAudioEnabled: false,
    callSttConnectionId: "",
    callSttModel: "",
    callAudioInputMode: "local_whisper",
    callVideoInputEnabled: false,
    callCharacterVideoEnabled: false,
    callAutomaticVideoClipsEnabled: false,
    callCustomVideoClipsEnabled: false,
    callSoundboardEnabled: true,
    sourceProfiles: {},
  };
  const voiceOptions = Array.from({ length: 48 }, (_, index) => {
    const suffix = String(index + 1).padStart(2, "0");
    return {
      id: `voice-${suffix}`,
      name: `Custom Voice ${suffix}`,
      description: `Uploaded account voice ${suffix}`,
      previewUrl: null,
      category: "personal",
      labels: { accent: index % 2 === 0 ? "Polish" : "English" },
    };
  });
  const characterName = `ElevenLabs Voice Picker Character ${Date.now()}`;
  const characterResponse = await page.request.post("/api/characters", {
    data: { data: { name: characterName } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };

  try {
    await page.route("**/api/tts/config", async (route) => {
      if (route.request().method() === "PUT") {
        Object.assign(config, route.request().postDataJSON());
        saveCount += 1;
        await route.fulfill({ status: 204 });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(config) });
    });
    await page.route("**/api/tts/voices", async (route) => {
      voiceFetchCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          voices: voiceOptions.map((voice) => voice.id),
          voiceOptions,
          fromProvider: true,
          source: "elevenlabs",
        }),
      });
    });
    await page.route("**/api/tts/models", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          models: [
            { id: "eleven_multilingual_v2", name: "Eleven Multilingual v2" },
            { id: "eleven_v3", name: "Eleven v3" },
            { id: "eleven_flash_v2_5", name: "Eleven Flash v2.5" },
          ],
          fromProvider: true,
          source: "elevenlabs",
        }),
      });
    });

    await page.goto("/");
    await page.locator('[data-tour="panel-connections"]').click();
    const rightPanel = page.locator('[data-component="RightPanel"]');
    const ttsLabel = rightPanel.getByText("Text to Speech", { exact: true });
    const ttsCard = ttsLabel.locator("xpath=../../..");
    await ttsCard.getByTitle("Expand").click();

    const modelSelect = ttsCard.getByRole("combobox", { name: "Model" });
    await expect(modelSelect.locator("option")).toHaveCount(3);
    await expect(modelSelect.locator('option[value="eleven_v3"]')).toHaveText("Eleven v3 (eleven_v3)");

    const allCharactersVoicePicker = ttsCard.getByRole("button", { name: "All Characters Voice" });
    await allCharactersVoicePicker.click();
    const voiceList = page.getByTestId("tts-voice-options");
    await expect(voiceList.getByRole("option")).toHaveCount(49);
    await expect(voiceList.getByText("Custom Voice 48 (voice-48)", { exact: true })).toBeAttached();
    await expect(voiceList).toHaveCSS("overflow-y", "scroll");
    expect(
      await voiceList.evaluate((element) => ({
        scrollable: element.scrollHeight > element.clientHeight,
        gutter: getComputedStyle(element).scrollbarGutter,
      })),
    ).toEqual({ scrollable: true, gutter: "stable" });

    await page.keyboard.press("Escape");
    await expect(allCharactersVoicePicker).toBeFocused();
    await ttsCard.getByRole("combobox", { name: "Voice Option" }).selectOption("per-character");
    const refreshButton = ttsCard.getByRole("button", { name: "Refresh", exact: true });
    await expect(refreshButton).toBeVisible();
    await ttsCard.getByRole("button", { name: "Add character voice" }).click();

    const characterPicker = ttsCard.getByRole("button", { name: "Select character" });
    await characterPicker.click();
    const characterList = page.getByTestId("tts-character-options");
    await expect(characterList).toBeVisible();
    await expect(characterList).toHaveCSS("overflow-y", "scroll");
    await expect(characterList.locator("xpath=../..")).toHaveCSS("position", "fixed");
    await characterList.getByRole("option", { name: characterName, exact: true }).click();
    await expect(characterPicker).toBeFocused();
    await characterPicker.click();
    await page.keyboard.press("Escape");
    await expect(characterPicker).toBeFocused();

    const characterVoicePicker = ttsCard.getByRole("button", { name: /^Voice for / });
    const characterVoiceTriggerBox = await characterVoicePicker.boundingBox();
    await characterVoicePicker.click();
    const characterVoiceList = page.getByTestId("tts-voice-options");
    const characterVoiceMenuBox = await characterVoiceList.locator("xpath=../..").boundingBox();
    expect(characterVoiceTriggerBox).not.toBeNull();
    expect(characterVoiceMenuBox).not.toBeNull();
    expect(characterVoiceMenuBox!.width).toBeGreaterThan(characterVoiceTriggerBox!.width + 40);
    await page.keyboard.press("Escape");
    await expect(characterVoicePicker).toBeFocused();

    const fetchesBeforeRefresh = voiceFetchCount;
    await refreshButton.click();
    await expect.poll(() => saveCount).toBeGreaterThan(0);
    await expect.poll(() => voiceFetchCount).toBeGreaterThan(fetchesBeforeRefresh);
  } finally {
    await page.request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("failed Game Lorebook Keeper run exposes a retry action", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Game session recovery regression is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Lorebook Retry Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameId: "lorebook-retry-smoke-game",
        gameSessionStatus: "concluded",
        gameLorebookKeeperEnabled: true,
        gamePreviousSessionSummaries: [
          {
            summary: "The party escaped the test dungeon.",
            resumePoint: "Outside the dungeon gate.",
            partyDynamics: "Relieved.",
            keyDiscoveries: [],
            characterMoments: [],
            littleDetails: [],
            npcUpdates: [],
            statsSnapshot: {},
            timestamp: new Date().toISOString(),
          },
        ],
        gameLorebookKeeperLastRun: {
          sessionNumber: 1,
          status: "failed",
          updatedAt: new Date().toISOString(),
          error: "Structured lorebook output was invalid.",
        },
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "The session has concluded." },
    });
    expect(messageResponse.ok()).toBeTruthy();

    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");
    await page.getByRole("button", { name: "Session" }).click();
    const failure = page.locator('[data-component="GameSessionHistory.LorebookKeeperFailure"]');
    await expect(failure).toContainText("Lorebook Keeper failed");
    await expect(failure.getByRole("button", { name: "Retry Lorebook Keeper" })).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Game history above the dialogue box opens a historical Peek Prompt", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Game historical prompt UI regression is covered on desktop.");

  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Game Prompt History Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    await page.request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { gameId: "prompt-history-smoke-game", gameSessionStatus: "active", gameSessionNumber: 1 },
    });
    await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "user", content: "Open the old gate." },
    });
    const historicalTurnResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: "The old gate opens with a groan.",
        extra: {
          cachedPrompt: [
            { role: "system", content: "Exact historical Game Master prompt" },
            { role: "user", content: "Open the old gate." },
          ],
        },
      },
    });
    expect(historicalTurnResponse.ok()).toBeTruthy();
    await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "user", content: "Step through." },
    });
    await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: "Beyond it waits a moonlit hall.",
        extra: { cachedPrompt: [{ role: "user", content: "Step through." }] },
      },
    });

    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            gameDialogueDisplayMode: "stacked",
          },
          version: 65,
        }),
      );
    }, chat.id);
    await page.goto("/");
    const peekButton = page.locator('[data-component="GameNarration.PeekPrompt"]').first();
    await expect(peekButton).toBeVisible();
    await peekButton.click();
    await expect(page.getByRole("heading", { name: "Assembled Prompt" })).toBeVisible();
    await expect(page.getByText("This is the exact cached text prompt sent for the selected turn.")).toBeVisible();
    await page.getByRole("button", { name: /System/ }).click();
    await expect(page.getByText("Exact historical Game Master prompt")).toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("home shell and primary topbar panels open without client errors", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  await page.goto("/");

  await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Marinara Engine" })).toBeVisible();

  const charactersButton = page.locator('[data-tour="panel-characters"]');
  await expect(charactersButton.locator("svg")).toHaveClass(/mari-topbar-accent-icon/);
  const personasButton = page.locator('[data-tour="panel-personas"]');
  await expect(personasButton.locator("svg")).toHaveClass(/lucide-venetian-mask/u);

  const corePanelOrder = await page
    .locator('[data-tour="panel-buttons"] > button[data-tour^="panel-"]')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("data-tour")));
  expect(corePanelOrder).toEqual([
    "panel-bot-browser",
    "panel-characters",
    "panel-personas",
    "panel-lorebooks",
    "panel-presets",
    "panel-connections",
    "panel-agents",
    "panel-settings",
  ]);

  for (const selector of [
    '[data-tour="sidebar-toggle"]',
    '[data-tour="panel-bot-browser"]',
    '[data-tour="panel-characters"]',
    '[data-tour="panel-personas"]',
    '[data-tour="panel-lorebooks"]',
    '[data-tour="panel-presets"]',
    '[data-tour="panel-connections"]',
    '[data-tour="panel-agents"]',
    '[data-tour="panel-settings"]',
  ]) {
    await page.locator(selector).click();
    await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
    if (selector === '[data-tour="panel-characters"]') {
      await expect(page.locator('[data-component="RightPanelHeaderIcon"]')).toHaveClass(
        /mari-panel-gradient--characters/,
      );
    }
    if (selector === '[data-tour="panel-personas"]') {
      await expect(page.locator('[data-component="RightPanelHeaderIcon"] svg')).toHaveClass(/lucide-venetian-mask/u);
    }
  }

  const health = await page.request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  expect(errors).toEqual([]);
});

test("Professor Mari introduces Browser, Characters, and Personas in topbar order", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const module = await import("/src/stores/ui.store.ts");
    module.useUIStore.getState().setHasCompletedOnboarding(false);
  });

  const next = page.getByRole("button", { name: "Next", exact: true });
  await expect(page.getByRole("heading", { name: "Welcome to Marinara Engine!", exact: true })).toBeVisible();
  await next.click();
  await expect(page.locator("h3").filter({ hasText: /^Browser$/ })).toBeVisible();
  await next.click();
  await expect(page.locator("h3").filter({ hasText: /^Characters$/ })).toBeVisible();
  await next.click();
  await expect(page.locator("h3").filter({ hasText: /^Personas$/ })).toBeVisible();
});

test("settings search divider stays aligned with editor headers across text scales", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Desktop split-pane alignment regression.");

  await page.goto("/");
  await page.evaluate(async () => {
    const module = await import("/src/stores/ui.store.ts");
    module.useUIStore.getState().openAgentDetail("__new__");
  });
  await expect(page.locator(".mari-editor-header")).toBeVisible();

  await page.locator('[data-tour="panel-settings"]').click();
  await expect(page.locator(".mari-settings-search-header")).toBeVisible();

  for (const fontSize of [15, 17, 22]) {
    await page.evaluate((size) => {
      document.documentElement.style.fontSize = `${size}px`;
    }, fontSize);

    await expect
      .poll(async () =>
        page.evaluate(() => {
          const topbar = document.querySelector<HTMLElement>('[data-component="TopBar"]');
          const rightPanelHeader = document.querySelector<HTMLElement>(".mari-right-panel-header");
          const editorHeader = document.querySelector<HTMLElement>(
            ".mari-editor-header:not(.mari-settings-search-header)",
          );
          const settingsSearchHeader = document.querySelector<HTMLElement>(".mari-settings-search-header");
          if (!topbar || !rightPanelHeader || !editorHeader || !settingsSearchHeader) return null;
          return {
            shellHeadersAligned:
              Math.abs(topbar.getBoundingClientRect().bottom - rightPanelHeader.getBoundingClientRect().bottom) < 0.1,
            contentHeadersAligned:
              Math.abs(
                editorHeader.getBoundingClientRect().bottom - settingsSearchHeader.getBoundingClientRect().bottom,
              ) < 0.1,
          };
        }),
      )
      .toEqual({ shellHeadersAligned: true, contentHeadersAligned: true });
  }
});

test("Backup & Export identifies the automatic backup location", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-tour="panel-settings"]').click();
  await page.getByPlaceholder("Search settings").fill("automatic backups");
  await page.locator(".mari-settings-search-header button").filter({ hasText: "Automatic backups" }).first().click();

  const backupSection = page.locator("#settings-section-backup-export");
  await expect(backupSection).toBeVisible();
  await expect(backupSection).toContainText("Automatic backups kept");
  await expect(backupSection.getByLabel("Number of automatic backups kept")).toHaveValue("1");
  await expect(backupSection).toContainText("DATA_DIR/backups");
  await expect(backupSection).toContainText("marinara-automatic-backup.zip");
  await expect(backupSection).toContainText("Docker defaults to /app/data");
  await expect(backupSection).toContainText("On Android, app storage is usually inaccessible");
});

test("custom generation parameters become reusable chat controls", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Reusable parameter authoring is covered on desktop.");

  let storedDefinitions = "[]";
  await page.route("**/api/app-settings/custom-generation-parameters", async (route) => {
    const request = route.request();
    if (request.method() === "PUT") {
      const body = request.postDataJSON() as { value?: unknown };
      storedDefinitions = typeof body.value === "string" ? body.value : "[]";
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        key: "custom-generation-parameters",
        value: storedDefinitions,
      }),
    });
  });

  const response = await page.request.post("/api/chats", {
    data: {
      name: "Managed Parameter Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-settings"]').click();
    await page.getByPlaceholder("Search settings").fill("custom generation parameters");
    await page
      .locator(".mari-settings-search-header button")
      .filter({ hasText: "Custom generation parameters" })
      .first()
      .click();

    const parameterSettings = page.locator("#settings-control-custom-generation-parameters");
    await expect(parameterSettings).toBeVisible();
    const parametersSection = page.locator("#settings-section-parameters");
    const parametersHelp = parametersSection.getByRole("button", { name: "Show help" });
    await parametersHelp.click();
    await expect(
      page.getByText(
        "Create reusable numeric provider parameters here. Once added, they become available in Chat Settings and connection defaults.",
        { exact: true },
      ),
    ).toBeVisible();
    await parametersHelp.click();

    await parameterSettings.getByRole("button", { name: "Add parameter" }).click();
    await parameterSettings.getByLabel("Name").fill("Min P");
    await parameterSettings.getByLabel("Value", { exact: true }).fill("min_p");
    await parameterSettings.getByLabel("Minimum value").fill("0,1");
    await parameterSettings.getByLabel("Maximum value").fill("1");
    await parameterSettings.getByLabel("Tooltip (optional)").fill("Filters low-probability tokens.");
    await parameterSettings.getByRole("button", { name: "Save parameter" }).click();

    await expect(parameterSettings.getByText("min_p", { exact: true })).toBeVisible();
    const editParameterButton = parameterSettings.getByRole("button", { name: "Edit Min P" });
    const deleteParameterButton = parameterSettings.getByRole("button", { name: "Delete Min P" });
    const [editParameterIconBox, deleteParameterIconBox] = await Promise.all([
      editParameterButton.locator("svg").boundingBox(),
      deleteParameterButton.locator("svg").boundingBox(),
    ]);
    expect(editParameterIconBox).not.toBeNull();
    expect(deleteParameterIconBox).not.toBeNull();
    expect(editParameterIconBox!.width).toBeGreaterThanOrEqual(16);
    expect(editParameterIconBox!.height).toBeGreaterThanOrEqual(16);
    expect(deleteParameterIconBox!.width).toBeGreaterThanOrEqual(16);
    expect(deleteParameterIconBox!.height).toBeGreaterThanOrEqual(16);

    const savedDefinitions = JSON.parse(storedDefinitions) as Array<{
      name: string;
      requestKey: string;
      min: number;
      max: number;
    }>;
    expect(savedDefinitions).toMatchObject([{ name: "Min P", requestKey: "min_p", min: 0.1, max: 1 }]);

    await page.evaluate((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.reload();

    await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
    const drawer = page.locator(".mari-chat-settings-drawer");
    await drawer.getByText("Advanced Parameters", { exact: true }).click();
    await expect(drawer.locator('textarea[placeholder="<thinking>"]')).toHaveAttribute("placeholder", "<thinking>");
    await expect(drawer.getByText("Min P", { exact: true })).toBeVisible();
    const minPInput = drawer.getByRole("textbox", { name: "Min P", exact: true });
    const [frequencyInputBox, presenceInputBox, minPInputBox] = await Promise.all([
      drawer.getByRole("textbox", { name: "Frequency", exact: true }).boundingBox(),
      drawer.getByRole("textbox", { name: "Presence", exact: true }).boundingBox(),
      minPInput.boundingBox(),
    ]);
    expect(frequencyInputBox).not.toBeNull();
    expect(presenceInputBox).not.toBeNull();
    expect(minPInputBox).not.toBeNull();
    expect(minPInputBox!.y).toBeGreaterThan(frequencyInputBox!.y + frequencyInputBox!.height);
    expect(minPInputBox!.y).toBeGreaterThan(presenceInputBox!.y + presenceInputBox!.height);

    await minPInput.fill("0,35");
    await minPInput.blur();
    const minPSendToggle = drawer.getByRole("checkbox", { name: "Send Min P parameter" });
    const minPSendToggleId = await minPSendToggle.getAttribute("id");
    expect(minPSendToggleId).toBeTruthy();
    await drawer.locator(`label[for="${minPSendToggleId}"]`).click();
    await expect(minPSendToggle).toBeChecked();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("UI language selection loads locale files and persists across reloads", async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectUnexpectedErrors(page);
  const languageSelect = page.locator("#settings-control-language select");

  // UI settings are normally synchronized through a single server record. Keep
  // this preference test browser-local so parallel desktop/mobile projects do
  // not overwrite each other's selected language.
  await page.route("**/api/app-settings/ui", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { value: null } });
      return;
    }
    const body = route.request().postDataJSON() as { value?: unknown } | null;
    await route.fulfill({ json: { value: typeof body?.value === "string" ? body.value : "" } });
  });

  const openGeneralSettings = async () => {
    const persistedPanelOpen = await page.evaluate(() => {
      const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
        state?: { rightPanelOpen?: unknown };
      };
      return persisted.state?.rightPanelOpen === true;
    });
    if (!(await languageSelect.isVisible()) && !persistedPanelOpen) {
      await page.locator('[data-tour="panel-settings"]').click();
    }
    await expect(languageSelect).toBeVisible({ timeout: 30_000 });
  };

  await page.goto("/");
  await openGeneralSettings();
  for (const locale of ["en", "ar", "de", "es", "fr", "hi", "ja", "ko", "pl", "pt-BR", "ru", "zh-Hans"]) {
    await expect(languageSelect.locator(`option[value="${locale}"]`)).toHaveCount(1);
  }

  await languageSelect.selectOption("pl");
  await expect(page.getByText("Działanie aplikacji", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Szukaj w ustawieniach")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Ogólne" })).toBeVisible();
  await expect(page.getByText("Potwierdzaj przed usunięciem", { exact: true })).toBeVisible();
  await expect(page.locator('[data-tour="panel-settings"]')).toHaveAttribute("title", "Ustawienia");
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe("pl");
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe("ltr");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
          state?: { language?: unknown };
        };
        return persisted.state?.language;
      }),
    )
    .toBe("pl");

  await page.reload();
  await openGeneralSettings();
  await expect(languageSelect).toHaveValue("pl");
  await expect(page.getByText("Działanie aplikacji", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Szukaj w ustawieniach")).toBeVisible();
  await expect(page.getByText("Potwierdzaj przed usunięciem", { exact: true })).toBeVisible();

  const translatedApplicationTitles = [
    { locale: "ar", direction: "rtl", title: "سلوك التطبيق" },
    { locale: "de", direction: "ltr", title: "App-Verhalten" },
    { locale: "es", direction: "ltr", title: "Comportamiento de la aplicación" },
    { locale: "fr", direction: "ltr", title: "Comportement de l’application" },
    { locale: "hi", direction: "ltr", title: "ऐप का व्यवहार" },
    { locale: "ja", direction: "ltr", title: "アプリの動作" },
    { locale: "ko", direction: "ltr", title: "앱 동작" },
    { locale: "pt-BR", direction: "ltr", title: "Comportamento do aplicativo" },
    { locale: "ru", direction: "ltr", title: "Поведение приложения" },
    { locale: "zh-Hans", direction: "ltr", title: "应用行为" },
  ] as const;

  for (const translation of translatedApplicationTitles) {
    await languageSelect.selectOption(translation.locale);
    await expect(page.getByText(translation.title, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(translation.locale);
    await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe(translation.direction);
  }

  await languageSelect.selectOption("ko");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { translate } = (await import("/src/localization/i18n.ts")) as {
          translate: (key: string, options?: Record<string, unknown>) => string;
        };
        return {
          repositoryImport: translate("ui.agents.customagentrepositoriesmodal.repositoryAgentsWillBeImported", {
            warning: "주의:",
            count: 3,
          }),
          catalogSummary: translate("ui.agents.agentcatalogview.catalogSummary", {
            availableCount: 7,
            installedCount: 3,
          }),
          importSelection: translate("ui.modals.stbulkimportmodal.selectedItems", { count: 3 }),
          importWarnings: translate("ui.modals.stbulkimportmodal.importWarnings", { count: 1 }),
          spriteConnection: translate("ui.ui.spritegenerationmodal.noVideoGenerationConnectionsFound"),
        };
      }),
    )
    .toEqual({
      repositoryImport: "주의: 에이전트 3개를 가져옵니다.",
      catalogSummary: "7개 사용 가능 • 3개 설치됨",
      importSelection: "3개 선택됨",
      importWarnings: "경고 1개",
      spriteConnection: '동영상 생성 연결이 없습니다. 설정 → 연결에서 "동영상 생성" 제공자 유형으로 추가하세요.',
    });

  // Community locales are intentionally partial. A newly extracted English
  // key must render in English when the selected locale has not translated it.
  await languageSelect.selectOption("es");
  await expect(page.getByPlaceholder("Search settings")).toBeVisible();
  await expect(page.getByText("Confirm before deleting", { exact: true })).toBeVisible();

  await languageSelect.selectOption("en");
  await expect(page.getByText("App Behavior", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe("ltr");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { translate } = (await import("/src/localization/i18n.ts")) as {
          translate: (key: string, options?: Record<string, unknown>) => string;
        };
        return {
          onePreset: translate("ui.modals.stbulkimportmodal.importedPresets", { count: 1 }),
          severalPresets: translate("ui.modals.stbulkimportmodal.importedPresets", { count: 3 }),
          oneWarning: translate("ui.modals.stbulkimportmodal.importWarnings", { count: 1 }),
          severalWarnings: translate("ui.modals.stbulkimportmodal.importWarnings", { count: 3 }),
        };
      }),
    )
    .toEqual({
      onePreset: "1 preset",
      severalPresets: "3 presets",
      oneWarning: "1 warning",
      severalWarnings: "3 warnings",
    });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
          state?: { language?: unknown };
        };
        return persisted.state?.language;
      }),
    )
    .toBe("en");

  await page.addInitScript(() => {
    const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
      state?: { language?: unknown };
    };
    persisted.state = { ...(persisted.state ?? {}), language: "not-a-real-locale" };
    localStorage.setItem("marinara-engine-ui", JSON.stringify(persisted));
  });
  await page.reload();
  await openGeneralSettings();
  await expect(languageSelect).toHaveValue("en");
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe("en");
  expect(errors).toEqual([]);
});

test("incomplete synced settings preserve disabled Game text effects and repair the server blob", async ({ page }) => {
  let rewrittenValue: string | null = null;
  await page.addInitScript(() => {
    localStorage.setItem(
      "marinara-engine-ui",
      JSON.stringify({
        state: { gameTextEffectsEnabled: false },
        version: 82,
      }),
    );
    localStorage.setItem("marinara-engine-ui-updated-at", "100");
  });
  await page.route("**/api/app-settings/ui", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          value: JSON.stringify({
            theme: "dark",
            __updatedAt: 200,
          }),
        },
      });
      return;
    }
    const body = route.request().postDataJSON() as { value?: unknown } | null;
    rewrittenValue = typeof body?.value === "string" ? body.value : null;
    await route.fulfill({ json: { value: rewrittenValue } });
  });

  await page.goto("/");
  await expect.poll(() => rewrittenValue).not.toBeNull();
  const rewritten = JSON.parse(rewrittenValue!) as {
    gameTextEffectsEnabled?: unknown;
    __updatedAt?: unknown;
  };
  expect(rewritten.gameTextEffectsEnabled).toBe(false);
  expect(typeof rewritten.__updatedAt).toBe("number");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
          state?: { gameTextEffectsEnabled?: unknown };
        };
        return persisted.state?.gameTextEffectsEnabled;
      }),
    )
    .toBe(false);
});

test("Browser labels and the Persona full library stay available across viewports", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  await page.route("**/api/bot-browser/chub/search?*", async (route) => {
    await route.fulfill({
      status: 503,
      json: { error: "offline" },
    });
  });
  await page.goto("/");

  await page.locator('[data-tour="panel-bot-browser"]').click();
  await expect(page.getByText("Browser", { exact: true })).toBeVisible();
  await expect(page.getByText("Card Browser", { exact: true })).toHaveCount(0);
  const downloadCards = page.getByRole("button", { name: "Download Cards" });
  await expect(downloadCards).toBeVisible();
  await downloadCards.click();

  const cardLibrary = page.locator('[data-component="BotBrowserView"]');
  await expect(cardLibrary.getByText("Cards Library", { exact: true })).toBeVisible();
  await expect(cardLibrary.getByRole("heading", { name: "Browse character cards online" })).toBeVisible();
  const searchError = cardLibrary.getByText("Search failed", { exact: true });
  await expect(searchError).toBeVisible();
  await expect(searchError).toHaveClass(/marinara-chat-chrome-panel-title/);
  const closeCardLibrary = cardLibrary.getByRole("button", { name: "Close library" });
  await expect(closeCardLibrary).toBeVisible();
  await closeCardLibrary.click();

  await page.locator('[data-tour="panel-personas"]').click();
  const openPersonaLibrary = page.getByRole("button", { name: "Open Personas Library" });
  await expect(openPersonaLibrary).toBeVisible();
  await openPersonaLibrary.click();

  await expect(page.getByText("Persona Library", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Browse your personas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New persona" })).toBeVisible();
  await expect(
    page.locator('[data-component="CharacterLibraryView"]').getByPlaceholder("Search personas"),
  ).toBeVisible();
  await expect(page.locator('[data-tour="panel-personas"]')).toHaveClass(/mari-topbar-panel-icon--active/);
  await expect(page.locator('[data-tour="panel-characters"]')).not.toHaveClass(/bg-\[var\(--accent\)\]/);
  expect(errors.filter((error) => !error.includes("status of 503 (Service Unavailable)"))).toEqual([]);
});

test("Character and Persona sidebars find cards by creator", async ({ page, request }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now().toString(36)}`;
  const characterName = `Sidebar Character ${suffix}`;
  const characterCreator = `Character Author ${suffix}`;
  const personaName = `Sidebar Persona ${suffix}`;
  const personaCreator = `Persona Author ${suffix}`;

  const characterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        creator: characterCreator,
        description: "The name deliberately does not contain the creator.",
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };

  const personaResponse = await request.post("/api/characters/personas", {
    data: {
      name: personaName,
      creator: personaCreator,
      description: "The name deliberately does not contain the creator.",
    },
  });
  expect(personaResponse.ok()).toBeTruthy();
  const persona = (await personaResponse.json()) as { id: string };

  const mobile = testInfo.project.name.includes("mobile");
  const rightPanel = page.locator(`[data-component="${mobile ? "RightPanelMobile" : "RightPanelDesktop"}"]`);

  try {
    await page.goto("/");

    await page.locator('[data-tour="panel-characters"]').click();
    await expect(rightPanel).toBeVisible();
    await rightPanel.getByPlaceholder('Search characters or -tag:"tag name"').fill(characterCreator);
    await expect(
      rightPanel.locator(`[data-touch-drag-card="character"][data-character-id="${character.id}"]`),
    ).toContainText(characterName);

    await page.locator('[data-tour="panel-personas"]').click();
    await expect(rightPanel).toBeVisible();
    await rightPanel.getByPlaceholder("Search personas").fill(personaCreator);
    await expect(rightPanel.locator('[data-touch-drag-card="persona"]').filter({ hasText: personaName })).toBeVisible();
  } finally {
    await Promise.all([
      request.delete(`/api/characters/${character.id}`).catch(() => undefined),
      request.delete(`/api/characters/personas/${persona.id}`).catch(() => undefined),
    ]);
  }
});

test("right-panel controls keep their width with and without a scrollbar", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop scrollbar geometry regression.");
  const suffix = Date.now().toString(36);
  const characterIds: string[] = [];
  let personaId: string | undefined;
  const personaName = `Short Persona ${suffix}`;
  let testFailure: { error: unknown } | null = null;

  try {
    const characterResponses = await Promise.all(
      Array.from({ length: 16 }, (_, index) =>
        request.post("/api/characters", {
          data: { data: { name: `Scrollbar Character ${suffix} ${index + 1}` } },
        }),
      ),
    );
    for (const response of characterResponses) {
      if (response.ok()) {
        const character = (await response.json()) as { id: string };
        characterIds.push(character.id);
      }
    }
    for (const response of characterResponses) expect(response.ok()).toBeTruthy();

    const personaResponse = await request.post("/api/characters/personas", { data: { name: personaName } });
    if (personaResponse.ok()) personaId = ((await personaResponse.json()) as { id: string }).id;
    expect(personaResponse.ok()).toBeTruthy();

    await page.goto("/");
    const rightPanel = page.locator('[data-component="RightPanelDesktop"]');
    await page.locator('[data-tour="panel-characters"]').click();
    const characterScroll = rightPanel.locator('[data-component="CharactersPanelScroll"]');
    await expect
      .poll(() => characterScroll.evaluate((element) => element.scrollHeight > element.clientHeight))
      .toBe(true);
    const characterLibraryButton = rightPanel.getByRole("button", { name: "Open Characters Library" });
    const characterButtonBox = await characterLibraryButton.boundingBox();
    expect(characterButtonBox).not.toBeNull();
    await expect(characterScroll).toHaveCSS("scrollbar-gutter", /stable/u);

    await page.locator('[data-tour="panel-personas"]').click();
    await rightPanel.getByPlaceholder("Search personas").fill(personaName);
    const personaScroll = rightPanel.locator('[data-panel-key="personas"]');
    await expect
      .poll(() => personaScroll.evaluate((element) => element.scrollHeight <= element.clientHeight))
      .toBe(true);
    const personaLibraryButton = rightPanel.getByRole("button", { name: "Open Personas Library" });
    const personaButtonBox = await personaLibraryButton.boundingBox();
    expect(personaButtonBox).not.toBeNull();
    await expect(personaScroll).toHaveCSS("scrollbar-gutter", /stable/u);
    expect(Math.abs(characterButtonBox!.width - personaButtonBox!.width)).toBeLessThan(0.5);
  } catch (error) {
    testFailure = { error };
  }

  const cleanupRequests = characterIds.map((id) => request.delete(`/api/characters/${id}`));
  if (personaId) cleanupRequests.push(request.delete(`/api/characters/personas/${personaId}`));
  const cleanupResults = await Promise.allSettled(cleanupRequests);
  const cleanupFailures: unknown[] = [];
  for (const result of cleanupResults) {
    if (result.status === "rejected") cleanupFailures.push(result.reason);
    else if (!result.value.ok()) cleanupFailures.push(new Error(`Fixture cleanup failed with HTTP ${result.value.status()}`));
  }

  const failures = [...(testFailure ? [testFailure.error] : []), ...cleanupFailures];
  if (failures.length > 1) throw new AggregateError(failures, "Test and fixture cleanup failed");
  if (failures.length === 1) throw failures[0];
});

test("downloadable agent catalog is usable on desktop and mobile", async ({ page }, testInfo) => {
  const errors = collectUnexpectedErrors(page);
  const catalogPackages = [
    {
      id: "uno",
      name: "UNO",
      description: "Play UNO with Conversation characters.",
      category: "misc",
    },
    {
      id: "prose-guardian",
      name: "Prose Guardian",
      description: "Keeps generated prose focused and consistent.",
      category: "writer",
    },
    {
      id: "character-tracker",
      name: "Character Tracker",
      description: "Tracks durable character state changes.",
      category: "tracker",
    },
    {
      id: "card-evolution-auditor",
      name: "Card Evolution Auditor",
      description: "Proposes durable character-card updates for review.",
      category: "writer",
    },
    {
      id: "hierarchical-maps",
      name: "Hierarchical Maps",
      description: "Tracks locations and spatial context.",
      category: "tracker",
    },
  ].map(({ id, name, description, category }) => ({
    category,
    manifest: {
      schemaVersion: 1,
      id,
      name,
      version: "1.0.0",
      description,
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind: ["agent"],
      entrypoints: { agents: "agents.json" },
      files: [],
      permissions: ["agent-runtime", "chat-read", "prompt-context", "ui"],
      restartRequired: false,
    },
    artifact: { url: `https://example.com/${id}.zip`, sha256: "a".repeat(64), bytes: 2048 },
    documentationUrl: `https://github.com/Pasta-Devs/Marinara-Agents#${id}`,
  }));
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-07-14T00:00:00.000Z",
        packages: catalogPackages,
      }),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  // Keep this catalog-only experiment isolated from the server-wide import-policy
  // mutation exercised by the dedicated Danger Zone flow in the other project.
  await page.route("**/api/agents/import-policy", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled: true }) });
  });
  await page.route("**/api/custom-agent-repositories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ enabled: true, repositories: [] }),
    });
  });
  await page.route("**/api/custom-agent-repositories/preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        repository: {
          id: "0123456789abcdef",
          url: "https://github.com/example/community-agents",
          owner: "example",
          name: "community-agents",
        },
        digest: "a".repeat(64),
        changes: [
          {
            agentId: "continuity-helper",
            name: "Continuity Helper",
            status: "new",
            changedFields: [],
            definition: {
              id: "continuity-helper",
              name: "Continuity Helper",
              description: "Checks recent turns for contradictions.",
              phase: "post_processing",
              enabledByDefault: false,
              category: "writer",
              defaultTools: ["search_messages"],
              defaultPromptTemplate: "Check {{messages}} for continuity errors.",
            },
          },
        ],
      }),
    });
  });
  await page.goto("/");
  await page.locator('[data-tour="panel-characters"]').click();
  await page.getByRole("button", { name: "Open Characters Library" }).click();
  await expect(page.getByRole("heading", { name: "Browse your characters" })).toBeVisible();
  await expect(
    page.locator('[data-component="CharacterLibraryView"]').getByPlaceholder('Search characters or -tag:"tag name"'),
  ).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await expect(page.locator('[data-component="RightPanelMobile"]')).toHaveCount(0);
  } else {
    await expect(page.locator('[data-component="RightPanelDesktop"]')).toBeVisible();
  }
  await page.getByTitle("Close library").click();

  await page.locator('[data-tour="panel-agents"]').click();
  await expect(page.getByText("No Agents installed yet, click Download Agents to add them!")).toBeVisible();
  await page.getByLabel("Agents").getByRole("button", { name: "Download Agents", exact: true }).click();

  const catalogView = page.locator('[data-component="AgentCatalogView"]');
  if (testInfo.project.name.includes("mobile")) {
    await expect(page.locator('[data-component="RightPanelMobile"]')).toHaveCount(0);
  } else {
    await expect(page.locator('[data-component="RightPanelDesktop"]')).toBeVisible();
  }
  await expect(catalogView.getByRole("heading", { name: "Download Agents" })).toBeVisible();
  await expect(catalogView.getByRole("heading", { name: "Installed Agents", exact: true })).toBeVisible();
  await expect(catalogView.getByRole("heading", { name: "Uninstalled Agents", exact: true })).toBeVisible();
  await expect(catalogView.locator("aside h3")).toHaveText(["Writer Agents", "Tracker Agents", "Misc Agents"]);
  const writerSection = catalogView.locator("aside h3", { hasText: "Writer Agents" }).locator("..");
  const trackerSection = catalogView.locator("aside h3", { hasText: "Tracker Agents" }).locator("..");
  await expect(writerSection.getByText("Card Evolution Auditor", { exact: true })).toBeVisible();
  await expect(trackerSection.getByText("Hierarchical Maps", { exact: true })).toBeVisible();
  await expect(catalogView.getByText("About Me Keeper")).toHaveCount(0);
  await expect(catalogView.getByText("Play UNO with Conversation characters.").first()).toBeVisible();
  const allAgentsButton = catalogView.locator("button", { hasText: "All agents" });
  if (testInfo.project.name.includes("mobile")) {
    await catalogView.getByRole("button", { name: "UNO Play UNO with Conversation characters.", exact: true }).click();
    await expect(allAgentsButton).toBeVisible();
    await allAgentsButton.click();
    await expect(allAgentsButton).toBeHidden();
    await catalogView.getByRole("button", { name: "UNO Play UNO with Conversation characters.", exact: true }).click();
  } else {
    await expect(allAgentsButton).toBeHidden();
  }
  await expect(catalogView.getByText("Marinara Engine v2.3.0+")).toBeVisible();
  const documentationLink = catalogView.getByRole("link", { name: "Read how this agent works" });
  await expect(documentationLink).toHaveAttribute(
    "href",
    "https://github.com/Pasta-Devs/Marinara-Agents#uno",
  );
  const installButton = catalogView.getByRole("button", { name: "Install", exact: true });
  await expect(installButton).toBeVisible();
  await expect(documentationLink).toHaveClass(/mari-chrome-control--primary/u);
  expect(await documentationLink.getAttribute("class")).toBe(await installButton.getAttribute("class"));
  const readActionStyles = async (selector: typeof documentationLink) =>
    selector.evaluate((element) => {
      const styles = getComputedStyle(element);
      return {
        borderRadius: styles.borderRadius,
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight,
        minHeight: styles.minHeight,
        padding: styles.padding,
      };
    });
  expect(await readActionStyles(documentationLink)).toEqual(await readActionStyles(installButton));
  await catalogView.getByRole("button", { name: "Custom Sources" }).click();
  const customSources = page.getByRole("dialog", { name: "Custom Agent Repositories" });
  await expect(customSources.getByText(/not affiliated with or vetted by PastaDevs/u)).toBeVisible();
  await customSources.getByLabel("GitHub agent repository URL").fill("https://github.com/example/community-agents");
  await customSources.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(customSources.getByRole("heading", { name: "example/community-agents" })).toBeVisible();
  await expect(customSources.getByText("Continuity Helper", { exact: true })).toBeVisible();
  await customSources.getByRole("button", { name: "Add Repository" }).click();
  const trustConfirmation = page.getByRole("dialog", { name: "Add this custom repository?" });
  await expect(trustConfirmation.getByText(/Custom agents can run tools/u)).toBeVisible();
  await trustConfirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(customSources).toBeVisible();
  expect(errors).toEqual([]);
});

test("Agent updates share one dismissible prompt and remain available after Not now", async ({ page }, testInfo) => {
  const errors = collectUnexpectedErrors(page);
  const installedManifest = {
    schemaVersion: 1,
    id: "prose-guardian",
    name: "Prose Guardian",
    version: "1.0.0",
    description: "Keeps generated prose focused and consistent.",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    files: [],
    permissions: ["agent-runtime", "chat-read", "prompt-context", "ui"],
    restartRequired: false,
  };
  const catalogManifest = { ...installedManifest, version: "1.1.0" };
  const availableUpdates = [
    {
      id: "prose-guardian",
      name: "Prose Guardian",
      installedVersion: "1.0.0",
      version: "1.1.0",
      restartRequired: false,
    },
    {
      id: "world-builder",
      name: "World Builder",
      installedVersion: "2.0.0",
      version: "2.1.0",
      restartRequired: true,
    },
  ];
  const declinedUpdateIds = new Set<string>();
  let declineRequests = 0;

  await page.route("**/api/capability-packages/updates/pending", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(availableUpdates.filter((update) => !declinedUpdateIds.has(update.id))),
    });
  });
  await page.route("**/api/capability-packages/*/updates/*/decline", async (route) => {
    declineRequests += 1;
    const packageId = decodeURIComponent(new URL(route.request().url()).pathname.split("/")[3] ?? "");
    declinedUpdateIds.add(packageId);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ declined: true }),
    });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-07-23T00:00:00.000Z",
        packages: [
          {
            category: "writer",
            manifest: catalogManifest,
            artifact: {
              url: "https://example.com/prose-guardian-1.1.0.zip",
              sha256: "a".repeat(64),
              bytes: 2048,
            },
            documentationUrl: "https://github.com/Pasta-Devs/Marinara-Agents#prose-guardian",
          },
        ],
      }),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "prose-guardian",
          version: "1.0.0",
          manifest: installedManifest,
          installedAt: "2026-07-22T00:00:00.000Z",
          status: "active",
          error: null,
          readiness: "ready",
          readinessError: null,
          legacy: false,
        },
      ]),
    });
  });
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/");

  const updateDialog = page.getByRole("dialog", { name: "Agent updates available" });
  await expect(updateDialog).toBeVisible();
  await expect(updateDialog.getByText(/update Agents later in Download Agents/u)).toBeVisible();
  await expect(updateDialog).toContainText("• Prose Guardian (1.0.0 → 1.1.0)");
  await expect(updateDialog).toContainText("• World Builder (2.0.0 → 2.1.0)");
  await expect(updateDialog.getByRole("button", { name: "Update all", exact: true })).toBeVisible();
  await expect(updateDialog.getByRole("button", { name: "Not now", exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const box = await updateDialog.boundingBox();
      const viewport = page.viewportSize();
      return Boolean(
        box &&
        viewport &&
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height,
      );
    })
    .toBe(true);

  await updateDialog.getByRole("button", { name: "Not now", exact: true }).click();
  await expect.poll(() => declineRequests).toBe(2);
  expect([...declinedUpdateIds].sort()).toEqual(["prose-guardian", "world-builder"]);
  await expect(updateDialog).toBeHidden();

  await page.locator('[data-tour="panel-agents"]').click();
  await page.getByLabel("Agents").getByRole("button", { name: "Download Agents", exact: true }).click();
  const catalogView = page.locator('[data-component="AgentCatalogView"]');
  await expect(catalogView.getByRole("heading", { name: "Download Agents" })).toBeVisible();
  if (testInfo.project.name.includes("mobile")) {
    await catalogView.getByRole("button", { name: /Prose Guardian/u }).click();
  }
  await expect(catalogView.getByRole("button", { name: "Update", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("agent catalog reports API failures without diagnosing an internet outage", async ({ page }) => {
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "Validation Error" }),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.goto("/");
  await page.locator('[data-tour="panel-agents"]').click();
  await page.getByLabel("Agents").getByRole("button", { name: "Download Agents", exact: true }).click();

  const catalogView = page.locator('[data-component="AgentCatalogView"]');
  await expect(catalogView.getByText("The agent catalog is unavailable.")).toBeVisible();
  await expect(catalogView.getByText(/Marinara Engine returned HTTP 400: Validation Error\./)).toBeVisible();
  await expect(catalogView.getByText(/Check the server internet connection/)).toHaveCount(0);
});

test("Music Player links to Music DJ while its package is unavailable", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  let musicDjInstalled = false;
  const musicDjManifest = {
    schemaVersion: 1,
    id: "spotify",
    name: "Music DJ",
    version: "1.0.0",
    description: "Matches scene mood with Spotify, YouTube, or local music.",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    files: [],
    permissions: ["agent-runtime", "chat-read", "prompt-context", "ui"],
    restartRequired: false,
  };
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        musicDjInstalled
          ? [
              {
                id: "spotify",
                version: "1.0.0",
                manifest: musicDjManifest,
                installedAt: "2026-07-15T00:00:00.000Z",
                status: "active",
                error: null,
                legacy: false,
              },
            ]
          : [],
      ),
    });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-07-15T00:00:00.000Z",
        packages: [
          {
            category: "misc",
            manifest: musicDjManifest,
            artifact: { url: "https://example.com/spotify.zip", sha256: "a".repeat(64), bytes: 2048 },
          },
        ],
      }),
    });
  });

  const openMusicPlayerSetting = async () => {
    await page.locator('[data-tour="panel-settings"]').click();
    const row = page.locator("#settings-control-music-player");
    await expect(row).toBeVisible();
    return row;
  };
  const expandUnavailablePlayer = async () => {
    const openPrompt = page.getByRole("button", { name: "Open Music DJ download prompt" });
    if (await openPrompt.isVisible()) await openPrompt.click();
  };

  await page.goto("/");
  let unavailablePlayer = page.locator('[data-component="MusicDjUnavailablePlayer"]');
  await expect(unavailablePlayer).toBeVisible();
  await expandUnavailablePlayer();
  await expect(unavailablePlayer.getByText("Download Music DJ Agent to configure", { exact: true })).toBeVisible();
  let musicPlayerRow = await openMusicPlayerSetting();
  const musicPlayerToggle = musicPlayerRow.locator('input[type="checkbox"]');
  await expect(musicPlayerToggle).toHaveCount(1);
  await expect(musicPlayerToggle).toBeChecked();
  await musicPlayerRow.getByText("Music Player", { exact: true }).click();
  await expect(musicPlayerToggle).not.toBeChecked();
  await expect(page.locator('[data-component="MusicDjUnavailablePlayer"]')).toHaveCount(0);
  await musicPlayerRow.getByText("Music Player", { exact: true }).click();
  await expect(musicPlayerToggle).toBeChecked();
  unavailablePlayer = page.locator('[data-component="MusicDjUnavailablePlayer"]');
  await expect(unavailablePlayer).toBeVisible();
  await expandUnavailablePlayer();

  musicDjInstalled = true;
  await page.reload();
  await expect(page.locator('[data-component="MusicDjUnavailablePlayer"]')).toHaveCount(0);
  musicPlayerRow = await openMusicPlayerSetting();
  await expect(musicPlayerRow.locator('input[type="checkbox"]')).toHaveCount(1);

  musicDjInstalled = false;
  await page.reload();
  unavailablePlayer = page.locator('[data-component="MusicDjUnavailablePlayer"]');
  await expect(unavailablePlayer).toBeVisible();
  await expandUnavailablePlayer();
  await unavailablePlayer.getByRole("button", { name: "Download Agents" }).click();
  await expect(page.locator('[data-component="AgentCatalogView"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Download Agents" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Connections exposes Local Whisper only while Conversation Calls is installed", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The capability ownership path is covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  let callsInstalled = true;
  const callsPackage = {
    id: "conversation-calls",
    version: "1.0.1",
    manifest: {
      schemaVersion: 1,
      id: "conversation-calls",
      name: "Conversation Calls",
      version: "1.0.1",
      description: "Audio and video calls for Conversation chats.",
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind: ["agent", "conversation-calls"],
      entrypoints: { client: "client.js", agents: "agents.json" },
      files: [],
      permissions: ["ui"],
      restartRequired: true,
    },
    installedAt: "2026-07-14T00:00:00.000Z",
    status: "active",
    error: null,
    legacy: false,
  };

  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(callsInstalled ? [callsPackage] : []),
    });
  });
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/conversation-calls/client?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        if (!customElements.get("marinara-capability-conversation-calls")) {
          customElements.define("marinara-capability-conversation-calls", class extends HTMLElement {});
        }
      `,
    });
  });
  await page.route("**/api/sidecar/speech/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "not_downloaded",
        config: { modelId: null },
        available: true,
        modelDownloaded: false,
        modelDisplayName: null,
        modelSize: null,
        models: [
          {
            id: "whisper_tiny",
            label: "Whisper Tiny (Multilingual)",
            repoId: "Xenova/whisper-tiny",
            description: "Fast local speech recognition.",
            sizeBytes: 180 * 1024 * 1024,
            ramBytes: 350 * 1024 * 1024,
          },
        ],
        downloadProgress: null,
        error: null,
        platform: "darwin",
        arch: "arm64",
        runtime: {
          packageFound: true,
          bindingFound: true,
          expectedBindingPath: "/tmp/onnxruntime_binding.node",
          installedBindingArchs: ["arm64"],
          platform: "darwin",
          arch: "arm64",
          nodeVersion: "v24.0.0",
          nodeExecPath: "/usr/bin/node",
          liteMode: false,
        },
      }),
    });
  });

  const openExpandedLocalModel = async () => {
    const rightPanel = page.locator('[data-component="RightPanel"]');
    await page.locator('[data-tour="panel-connections"]').click();
    await expect(rightPanel).toBeVisible();
    const localModelLabel = rightPanel.getByText("Local Model", { exact: true });
    await localModelLabel.evaluate((element) => element.parentElement?.parentElement?.click());
    const localModelCard = localModelLabel.locator("xpath=../../..");
    await expect(localModelCard.getByTitle("Collapse")).toBeVisible();
    return rightPanel;
  };

  await page.goto("/");
  let rightPanel = await openExpandedLocalModel();
  await expect(rightPanel.getByText("Local Speech Model", { exact: true })).toBeVisible();
  await expect(rightPanel.getByRole("button", { name: "Download Whisper" })).toBeVisible();

  callsInstalled = false;
  await page.reload();
  rightPanel = await openExpandedLocalModel();
  await expect(rightPanel.getByText("Local Speech Model", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("agent catalog can install and uninstall every package", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Bulk agent package actions are covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  const packageIds = ["prose-guardian", "character-tracker", "uno"];
  const installedIds = new Set<string>();
  const installRequests: string[] = [];
  const uninstallRequests: string[] = [];
  const catalogPackages = packageIds.map((id, index) => {
    const names = ["Prose Guardian", "Character Tracker", "UNO"];
    const categories = ["writer", "tracker", "misc"];
    return {
      category: categories[index],
      manifest: {
        schemaVersion: 1,
        id,
        name: names[index],
        version: "1.0.0",
        description: `Description for ${names[index]}.`,
        engine: { min: "2.3.0", maxExclusive: "3.0.0" },
        kind: ["agent"],
        entrypoints: { agents: "agents.json" },
        files: [],
        permissions: ["agent-runtime", "chat-read", "prompt-context"],
        restartRequired: false,
      },
      artifact: { url: `https://example.com/${id}.zip`, sha256: "a".repeat(64), bytes: 2048 },
    };
  });

  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-07-14T00:00:00.000Z",
        packages: catalogPackages,
      }),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        catalogPackages
          .filter((entry) => installedIds.has(entry.manifest.id))
          .map((entry) => ({
            id: entry.manifest.id,
            version: entry.manifest.version,
            manifest: entry.manifest,
            installedAt: "2026-07-14T00:00:00.000Z",
            status: "active",
            error: null,
            legacy: false,
          })),
      ),
    });
  });
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route(/\/api\/capability-packages\/[^/]+\/install$/, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const id = decodeURIComponent(pathname.split("/").at(-2) ?? "");
    installRequests.push(id);
    installedIds.add(id);
    const entry = catalogPackages.find((candidate) => candidate.manifest.id === id);
    expect(entry).toBeTruthy();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id,
        version: entry!.manifest.version,
        manifest: entry!.manifest,
        installedAt: "2026-07-14T00:00:00.000Z",
        status: "active",
        error: null,
        legacy: false,
      }),
    });
  });
  await page.route(/\/api\/capability-packages\/[^/]+$/, async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }
    const id = decodeURIComponent(new URL(route.request().url()).pathname.split("/").at(-1) ?? "");
    uninstallRequests.push(id);
    installedIds.delete(id);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ restartRequired: false }),
    });
  });

  await page.goto("/");
  await page.locator('[data-tour="panel-agents"]').click();
  await page.getByRole("button", { name: "Download Agents" }).click();

  const catalogView = page.locator('[data-component="AgentCatalogView"]');
  const installAllButton = catalogView.getByRole("button", { name: "Install All", exact: true });
  const uninstallAllButton = catalogView.getByRole("button", { name: "Uninstall All", exact: true });
  await expect(installAllButton).toBeEnabled();
  await expect(uninstallAllButton).toBeDisabled();

  await catalogView.getByRole("textbox", { name: "Search downloadable agents" }).fill("UNO");
  await installAllButton.click();
  await expect.poll(() => installedIds.size).toBe(packageIds.length);
  await expect(installAllButton).toBeDisabled();
  await expect(uninstallAllButton).toBeEnabled();
  expect(installRequests).toEqual(packageIds);

  await uninstallAllButton.click();
  const confirmDialog = page.getByRole("dialog", { name: "Uninstall all 3 agents?" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Uninstall All", exact: true }).click();
  await expect.poll(() => installedIds.size).toBe(0);
  await expect(installAllButton).toBeEnabled();
  await expect(uninstallAllButton).toBeDisabled();
  expect(uninstallRequests).toEqual(packageIds);
  expect(errors).toEqual([]);
});

test("installed package artwork appears in the sidebar and clears immediately on uninstall", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The persistent Agents sidebar is a desktop workflow.");

  const errors = collectUnexpectedErrors(page);
  let installed = true;
  const packageManifest = {
    schemaVersion: 1,
    id: "prose-guardian",
    name: "Prose Guardian",
    version: "1.0.0",
    description: "Keeps generated prose focused and consistent.",
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    files: [],
    permissions: ["agent-runtime", "chat-read", "prompt-context"],
    restartRequired: false,
  };
  const agentManifest = {
    id: "prose-guardian",
    name: "Prose Guardian",
    description: "Keeps generated prose focused and consistent.",
    author: "Pasta Devs",
    phase: "post_processing",
    enabledByDefault: false,
    category: "writer",
    defaultPromptTemplate: "Review the prose.",
  };

  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 1,
        generatedAt: "2026-07-14T00:00:00.000Z",
        packages: [
          {
            category: "writer",
            iconUrl: "https://example.com/prose-guardian-artwork.gif",
            manifest: packageManifest,
            artifact: {
              url: "https://example.com/prose-guardian.zip",
              sha256: "a".repeat(64),
              bytes: 2048,
            },
          },
        ],
      }),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        installed
          ? [
              {
                id: packageManifest.id,
                version: packageManifest.version,
                manifest: packageManifest,
                installedAt: "2026-07-14T00:00:00.000Z",
                status: "active",
                error: null,
                legacy: false,
              },
            ]
          : [],
      ),
    });
  });
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(installed ? [agentManifest] : []),
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("https://example.com/prose-guardian-artwork.gif", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
    });
  });
  await page.route("**/api/capability-packages/prose-guardian", async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }
    installed = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ restartRequired: false }),
    });
  });

  await page.goto("/");
  await page.locator('[data-tour="panel-agents"]').click();
  const agentsSidebar = page.locator('[data-component="RightPanelDesktop"]');
  const proseGuardianCard = agentsSidebar.locator('[data-agent-name="Prose Guardian"]');
  await expect(proseGuardianCard).toBeVisible();
  await expect(proseGuardianCard.locator('[data-component="AgentArtwork"]')).toHaveAttribute(
    "src",
    "https://example.com/prose-guardian-artwork.gif",
  );

  await agentsSidebar.getByRole("button", { name: "Download Agents" }).click();
  const catalogView = page.locator('[data-component="AgentCatalogView"]');
  await expect(catalogView.getByRole("button", { name: "Uninstall", exact: true })).toBeVisible();
  await catalogView.getByRole("button", { name: "Uninstall", exact: true }).click();
  const confirmDialog = page.getByRole("dialog", { name: "Uninstall Prose Guardian?" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Uninstall", exact: true }).click();

  await expect(agentsSidebar.getByText("Prose Guardian", { exact: true })).toHaveCount(0);
  await expect(agentsSidebar.getByText("No Agents installed yet, click Download Agents to add them!")).toBeVisible();
  await expect(catalogView.getByRole("button", { name: "Install", exact: true })).toBeVisible();
  await expect(agentsSidebar).toBeVisible();
  expect(errors).toEqual([]);
});

test("Conversation feature packages expose commands and settings without per-chat attachment", async ({
  page,
}, testInfo) => {
  test.skip(
    !testInfo.project.name.includes("desktop"),
    "Conversation agent settings regression is covered on desktop.",
  );

  const errors = collectUnexpectedErrors(page);
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Conversation Agent Settings Smoke", mode: "conversation", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  let conversationFeaturesInstalled = false;
  let clientLoadAttempts = 0;
  const releaseInitialClientLoad = createDeferred();
  const illustratorManifest = {
    id: "illustrator",
    name: "Illustrator",
    description: "Generates image prompts for important visual moments.",
    author: "Pasta Devs",
    phase: "post_processing",
    enabledByDefault: false,
    category: "misc",
    defaultPromptTemplate: "Return a concise image prompt.",
  };
  const conversationFeatureManifests = [
    illustratorManifest,
    ...[
      ["conversation-calls", "Conversation Calls"],
      ["eightball", "8-Ball Pool"],
      ["chess", "Chess"],
      ["poker", "Poker"],
      ["rock-paper-scissors", "Rock-Paper-Scissors"],
      ["tic-tac-toe", "Tic-Tac-Toe"],
      ["uno", "UNO"],
    ].map(([id, name]) => ({
      id,
      name,
      description: `${name} Conversation feature.`,
      author: "Pasta Devs",
      phase: "pre_generation",
      enabledByDefault: false,
      category: "misc",
      runtimeDisabled: true,
      modeAllowlist: ["conversation"],
      execution: "feature",
      defaultPromptTemplate: "",
    })),
  ];
  const callsInstalledPackage = {
    id: "conversation-calls",
    version: "1.0.0",
    manifest: {
      schemaVersion: 1,
      id: "conversation-calls",
      name: "Conversation Calls",
      version: "1.0.0",
      description: "Audio and video calls for Conversation chats.",
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind: ["agent", "conversation-calls"],
      entrypoints: { client: "client.js", agents: "agents.json" },
      files: [],
      permissions: ["ui"],
      restartRequired: true,
    },
    installedAt: "2026-07-14T00:00:00.000Z",
    status: "active",
    error: null,
    legacy: false,
  };

  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(conversationFeaturesInstalled ? conversationFeatureManifests : []),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(conversationFeaturesInstalled ? [callsInstalledPackage] : []),
    });
  });
  await page.route("**/api/capability-packages/conversation-calls/client?*", async (route) => {
    clientLoadAttempts += 1;
    if (clientLoadAttempts === 1) {
      await releaseInitialClientLoad.promise;
      await route.fulfill({
        status: 503,
        contentType: "application/javascript",
        body: "Service unavailable",
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        if (!customElements.get("marinara-capability-conversation-calls")) {
          customElements.define("marinara-capability-conversation-calls", class extends HTMLElement {
            connectedCallback() {
              this.addEventListener("marinara-capability-props", () => this.render());
              this.render();
            }
            render() {
              if (this.getAttribute("view") !== "settings") return;
              const props = this.capabilityProps || {};
              const enabled = props.metadata?.conversationCallsEnabled === true;
              this.innerHTML = '<section class="mari-chat-option-field"><span>Conversation Calls</span><button type="button">Audio/Video Calls</button><button type="button" data-crash-capability>Crash capability</button>' + (enabled ? '<span>Call Audio Pipeline</span>' : '') + '</section>';
              this.querySelector("button:not([data-crash-capability])")?.addEventListener("click", () => {
                props.updateMetadata?.({ conversationCallsEnabled: !enabled });
              });
              this.querySelector("[data-crash-capability]")?.addEventListener("click", () => {
                const message = "Injected capability runtime failure";
                this.capabilityRuntimeError = message;
                this.dispatchEvent(new CustomEvent("marinara-capability-runtime-error", { detail: { message }, bubbles: true }));
              });
            }
          });
        }
      `,
    });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-14T00:00:00.000Z", packages: [] }),
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/lorebooks/scan/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 }),
    });
  });
  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);

  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Chat Settings" }).click();
    let drawer = page.locator(".mari-chat-settings-drawer");
    const openAgentsSection = async () => {
      const agentsSection = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents$/ });
      await expect(agentsSection).toHaveCount(1);
      if ((await agentsSection.getAttribute("aria-expanded")) !== "true") {
        await agentsSection.click();
      }
      await expect(agentsSection).toHaveAttribute("aria-expanded", "true");
    };
    await openAgentsSection();
    await expect(drawer.getByText("Commands", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Schedule Updates", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Memories", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Selfies", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Illustrator Settings", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Conversation Calls", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Enable Agents", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Agent Suite", { exact: true })).toHaveCount(0);
    await expect(drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Commands$/ })).toHaveCount(0);

    conversationFeaturesInstalled = true;
    await page.reload();
    await page.getByRole("button", { name: "Chat Settings" }).click();
    drawer = page.locator(".mari-chat-settings-drawer");
    await openAgentsSection();
    await expect(
      drawer.locator('[data-capability-client-state="loading"][data-capability-package-id="conversation-calls"]'),
    ).toBeVisible();
    releaseInitialClientLoad.resolve();
    const clientLoadFailure = drawer.getByRole("alert").filter({ hasText: "Conversation Calls didn't load" });
    await expect(clientLoadFailure).toBeVisible();
    await expect(
      clientLoadFailure.getByText("Your chat and saved data are unchanged.", { exact: false }),
    ).toBeVisible();
    const clientLoadRetry = clientLoadFailure.getByRole("button", { name: "Try again", exact: true });
    expect((await clientLoadRetry.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await clientLoadRetry.click();
    await expect(clientLoadFailure).toHaveCount(0);
    await expect(drawer.getByText("Commands", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Selfies", { exact: true })).toBeVisible();
    await expect(drawer.getByText("8-Ball Pool", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Chess", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Poker", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Rock-Paper-Scissors", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Tic-Tac-Toe", { exact: true })).toBeVisible();
    await expect(drawer.getByText("UNO", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Illustrator Settings", { exact: true })).toBeVisible();
    await expect(drawer.getByText("Conversation Calls", { exact: true })).toBeVisible();
    const callsCapability = drawer.locator("marinara-capability-conversation-calls");
    await expect(callsCapability).toHaveAttribute("lang", "en");
    await expect(callsCapability).toHaveAttribute("dir", "ltr");
    await expect
      .poll(() =>
        callsCapability.evaluate((element) => {
          const capability = element as HTMLElement & {
            capabilityProps?: { localization?: { locale?: unknown; direction?: unknown } };
          };
          return capability.capabilityProps?.localization ?? null;
        }),
      )
      .toEqual({ locale: "en", direction: "ltr" });
    await expect(drawer.getByText("Call Audio Pipeline", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Enable Agents", { exact: true })).toHaveCount(0);
    await expect(drawer.getByText("Agent Suite", { exact: true })).toHaveCount(0);
    const illustratorSettings = drawer.getByText("Illustrator Settings", { exact: true });
    const callsSettings = drawer.getByText("Conversation Calls", { exact: true });
    const callsSettingsHandle = await callsSettings.elementHandle();
    if (!callsSettingsHandle) throw new Error("Conversation Calls settings did not render");
    expect(
      await illustratorSettings.evaluate(
        (illustrator, calls) =>
          calls instanceof Node &&
          Boolean(illustrator.compareDocumentPosition(calls) & Node.DOCUMENT_POSITION_FOLLOWING),
        callsSettingsHandle,
      ),
    ).toBe(true);
    await drawer.getByRole("button", { name: "Audio/Video Calls", exact: true }).click();
    await expect(drawer.getByText("Call Audio Pipeline", { exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: "Crash capability", exact: true }).click();
    const runtimeFailure = drawer.getByRole("alert").filter({ hasText: "Conversation Calls stopped" });
    await expect(runtimeFailure).toBeVisible();
    const runtimeRetry = runtimeFailure.getByRole("button", { name: "Try again", exact: true });
    expect((await runtimeRetry.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await runtimeRetry.click();
    await expect(runtimeFailure).toHaveCount(0);
    await expect(drawer.getByText("Conversation Calls", { exact: true })).toBeVisible();
    await expect(drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Commands$/ })).toHaveCount(0);
    expect(clientLoadAttempts).toBe(2);
    expect(errors.some((error) => error.includes("Could not load client capability conversation-calls"))).toBe(true);
    expect(
      errors.filter(
        (error) =>
          !error.includes("Could not load client capability conversation-calls") &&
          !/Failed to load resource:.*503/iu.test(error),
      ),
    ).toEqual([]);
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

test("Conversation setup commands follow the installed agent library", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Conversation setup command regression is covered on desktop.");
  test.setTimeout(90_000);

  const errors = collectUnexpectedErrors(page);
  const beforeResponse = await request.get("/api/chats");
  const beforeChats = (await beforeResponse.json()) as Array<{ id: string }>;
  const existingChatIds = new Set(beforeChats.map((chat) => chat.id));
  const connectionResponse = await request.post("/api/connections", {
    data: { name: `Conversation Setup Smoke ${Date.now()}`, provider: "custom" },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  let illustratorInstalled = false;
  const illustratorManifest = {
    id: "illustrator",
    name: "Illustrator",
    description: "Generates image prompts for important visual moments.",
    author: "Pasta Devs",
    phase: "post_processing",
    enabledByDefault: false,
    category: "misc",
    defaultPromptTemplate: "Return a concise image prompt.",
  };

  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(illustratorInstalled ? [illustratorManifest] : []),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-14T00:00:00.000Z", packages: [] }),
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/lorebooks/scan/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 }),
    });
  });

  const openAutomationStep = async () => {
    const newConversationButton = page.getByLabel("New Conversation", { exact: true });
    if (!(await newConversationButton.isVisible())) {
      await page.locator('[data-tour="sidebar-toggle"]').click();
    }
    await expect(newConversationButton).toBeVisible();
    const conversationModeButton = page.locator('[data-tour="chat-mode-conversation"]');
    if ((await conversationModeButton.getAttribute("aria-pressed")) !== "true") {
      await conversationModeButton.click();
    }
    const chatCreated = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/chats",
    );
    await newConversationButton.evaluate((button: HTMLButtonElement) => button.click());
    const connectionGate = page.getByRole("heading", { name: "Set Up Conversation", exact: true });
    const wizardHeading = page.getByRole("heading", { name: "New Conversation", exact: true });
    await expect(connectionGate.or(wizardHeading)).toBeVisible();
    if (await connectionGate.isVisible()) {
      await page.getByRole("button", { name: "Create Chat", exact: true }).click();
    }
    expect((await chatCreated).ok()).toBeTruthy();
    await expect(wizardHeading).toBeVisible();
    const nextButton = page.getByRole("button", { name: "Next", exact: true });
    await nextButton.click();
    await nextButton.click();
    await nextButton.click();
    await expect(page.getByRole("heading", { name: "Automation", exact: true })).toBeVisible();
    const commandsToggle = page.getByRole("button", { name: /^Commands\b/u });
    await expect(commandsToggle).toBeVisible();
    await commandsToggle.click();
    await expect(page.getByText("Schedule Updates", { exact: true })).toBeVisible();
  };

  try {
    await page.goto("/");
    await openAutomationStep();
    await expect(page.getByText("Commands", { exact: true })).toBeVisible();
    await expect(page.getByText("Schedule Updates", { exact: true })).toBeVisible();
    await expect(page.getByText("Memories", { exact: true })).toBeVisible();
    await expect(page.getByText("Selfies", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Calls", { exact: true })).toHaveCount(0);
    let setupWizard = page.getByRole("heading", { name: "New Conversation", exact: true }).locator("../..");
    await expect(setupWizard.getByRole("button", { name: "Download Agents", exact: true })).toBeVisible();

    illustratorInstalled = true;
    await page.reload();
    await openAutomationStep();
    await expect(page.getByText("Schedule Updates", { exact: true })).toBeVisible();
    await expect(page.getByText("Selfies", { exact: true })).toBeVisible();
    await expect(page.getByText("Calls", { exact: true })).toHaveCount(0);
    setupWizard = page.getByRole("heading", { name: "New Conversation", exact: true }).locator("../..");
    await expect(setupWizard.getByRole("button", { name: "Download Agents", exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    const afterResponse = await request.get("/api/chats");
    const afterChats = (await afterResponse.json()) as Array<{ id: string }>;
    await Promise.all(
      afterChats
        .filter((chat) => !existingChatIds.has(chat.id))
        .map((chat) => request.delete(`/api/chats/${chat.id}`, { timeout: 10_000 })),
    );
    await request.delete(`/api/connections/${connection.id}`, { timeout: 10_000 });
  }
});

test("Game setup only shows features owned by installed agents", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Game setup agent feature regression is covered on desktop.");
  test.setTimeout(90_000);

  const errors = collectUnexpectedErrors(page);
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Game Setup Agent Features Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  let installedAgentIds = new Set<string>();
  const agentNames: Record<string, string> = {
    "hierarchical-maps": "Hierarchical Maps",
    illustrator: "Illustrator",
    "lorebook-keeper": "Lorebook Keeper",
    spotify: "Music DJ",
  };

  await page.route("**/api/capability-packages/agents", async (route) => {
    const manifests = Array.from(installedAgentIds).map((id) => ({
      id,
      name: agentNames[id] ?? id,
      description: `${agentNames[id] ?? id} test manifest.`,
      author: "Pasta Devs",
      phase: "post_processing",
      enabledByDefault: false,
      category: id === "hierarchical-maps" ? "tracker" : "misc",
      defaultPromptTemplate: "Test prompt.",
    }));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(manifests) });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-14T00:00:00.000Z", packages: [] }),
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/lorebooks/scan/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 }),
    });
  });
  await page.route("**/api/game-assets/manifest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ scannedAt: "2026-07-14T00:00:00.000Z", count: 0, assets: {}, byCategory: {} }),
    });
  });
  await page.route("**/api/backgrounds/file/Black.jpg**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
    });
  });
  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);

  const openLorebooksStep = async () => {
    const dialog = page.getByRole("dialog", { name: "New Game" });
    await expect(dialog).toBeVisible();
    const recommendation = dialog.getByText(
      "Use a strong model for the initial world generation. You can change it later in Chat Settings.",
    );
    await expect(recommendation).toHaveClass(/text-\[var\(--primary\)\]/);
    for (const heading of ["World", "Party", "Goals", "Lorebooks"]) {
      await dialog.getByRole("button", { name: "Next", exact: true }).click();
      await expect(dialog.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    return dialog;
  };

  try {
    await page.goto("/");
    const initialDialog = page.getByRole("dialog", { name: "New Game" });
    const importButton = initialDialog.getByRole("button", { name: "Import setup", exact: true });
    await expect(importButton).toBeEnabled();
    await initialDialog.getByLabel("Import Game Mode setup file").setInputFiles({
      name: "tower-run.marinara-game-setup.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "marinara-game-setup",
          version: 1,
          exportedAt: "2026-07-16T12:00:00.000Z",
          gameName: "Imported Tower Run",
          setup: {
            config: {
              genre: "Fantasy",
              setting: "A city built around a shifting dungeon tower",
              tone: "Heroic",
              difficulty: "Hard",
              playerGoals: "Reach the final floor",
              gmMode: "standalone",
              rating: "sfw",
              partyCharacterIds: [],
              generationParameters: { temperature: 0.65 },
            },
            effectiveGenerationParameters: { temperature: 0.65, maxTokens: 8192 },
            preferences: "Use clear progression and frequent loot rewards.",
            createdAt: "2026-07-16T11:00:00.000Z",
          },
        }),
      ),
    });
    await expect(initialDialog.locator('input[placeholder="Name your adventure..."]')).toHaveValue(
      "Imported Tower Run",
    );
    await expect(
      initialDialog.getByText("tower-run.marinara-game-setup.json loaded. Review the steps, then start the new game.", {
        exact: true,
      }),
    ).toBeVisible();

    const temperatureField = initialDialog.locator('input[inputmode="decimal"]').first();
    await expect(temperatureField).toHaveValue("0.65");
    await initialDialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(initialDialog.getByRole("heading", { name: "World", exact: true })).toBeVisible();
    await expect(initialDialog.locator('input[placeholder="Describe your world…"]')).toHaveValue(
      "A city built around a shifting dungeon tower",
    );
    await expect(initialDialog.getByRole("button", { name: "Hard", exact: true })).toHaveClass(
      /bg-\[var\(--primary\)\]\/20/,
    );
    await initialDialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(initialDialog.getByRole("heading", { name: "Party", exact: true })).toBeVisible();
    await initialDialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(initialDialog.getByRole("heading", { name: "Goals", exact: true })).toBeVisible();
    await expect(initialDialog.locator('textarea[placeholder="What do you want to achieve?"]')).toHaveValue(
      "Reach the final floor",
    );
    await expect(initialDialog.locator('textarea[placeholder="Any extra details for the GM?"]')).toHaveValue(
      "Use clear progression and frequent loot rewards.",
    );
    await initialDialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(initialDialog.getByRole("heading", { name: "Lorebooks", exact: true })).toBeVisible();

    let dialog = initialDialog;
    await expect(dialog.getByText("Hierarchical world map", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
    await expect(dialog.getByText("Music DJ", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Lorebook Keeper", { exact: true })).toHaveCount(0);
    await expect(dialog.getByText("Illustrator", { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Download Agents", exact: true })).toBeVisible();

    installedAgentIds = new Set(["spotify", "lorebook-keeper", "illustrator"]);
    await page.reload();
    dialog = await openLorebooksStep();
    await expect(dialog.getByText("Hierarchical world map", { exact: true })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: /^Enable Agents\b/u }).click();
    await expect(dialog.getByText("Music DJ", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Lorebook Keeper", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Illustrator", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Visual Generation", { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Download Agents", exact: true })).toHaveCount(0);

    installedAgentIds.add("hierarchical-maps");
    await page.reload();
    dialog = await openLorebooksStep();
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Features", exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: /^Enable Agents\b/u }).click();
    await expect(dialog.getByText("Hierarchical world map", { exact: true })).toBeVisible();
    const manualMapButton = dialog.getByRole("button", { name: /^Create manually\b/u });
    const aiMapButton = dialog.getByRole("button", { name: /^Draft with AI\b/u });
    await expect(manualMapButton).toBeVisible();
    await expect(manualMapButton).toHaveAttribute("aria-pressed", "false");
    await manualMapButton.click();
    await expect(manualMapButton).toHaveAttribute("aria-pressed", "true");
    await expect(aiMapButton).toHaveAttribute("aria-pressed", "false");
    await aiMapButton.click();
    await expect(aiMapButton).toHaveAttribute("aria-pressed", "true");
    await expect(manualMapButton).toHaveAttribute("aria-pressed", "false");
    await expect(dialog.getByText("Map size", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/chats/${chat.id}`, { timeout: 10_000 });
  }
});

test("Conversation Chat Settings can attach and retain custom agents", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Conversation custom-agent settings are covered on desktop.");

  const suffix = Date.now().toString(36);
  const agentName = `Conversation Custom Agent ${suffix}`;
  let agentId: string | null = null;
  let chatId: string | null = null;

  try {
    const agentResponse = await request.post("/api/agents", {
      data: {
        type: `conversation-custom-agent-${suffix}`,
        name: agentName,
        description: "Conversation custom-agent regression fixture.",
        phase: "post_processing",
        connectionId: null,
        promptTemplate: "Return the original text.",
        settings: {},
      },
    });
    expect(agentResponse.ok()).toBeTruthy();
    const agent = (await agentResponse.json()) as { id: string; type: string };
    agentId = agent.id;

    const chatResponse = await request.post("/api/chats", {
      data: { name: `Conversation Custom Agent Smoke ${suffix}`, mode: "conversation", characterIds: [] },
    });
    expect(chatResponse.ok()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string };
    chatId = chat.id;

    const readAgentState = async () => {
      const response = await request.get(`/api/chats/${chat.id}`);
      if (!response.ok()) return null;
      const current = (await response.json()) as { metadata?: unknown };
      const metadata =
        typeof current.metadata === "string"
          ? (JSON.parse(current.metadata) as Record<string, unknown>)
          : ((current.metadata ?? {}) as Record<string, unknown>);
      return {
        enabled: metadata.enableAgents === true,
        active: Array.isArray(metadata.activeAgentIds) && metadata.activeAgentIds.includes(agent.type),
      };
    };
    const openAgentsSection = async (drawer: Locator) => {
      const section = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents/ });
      if ((await section.getAttribute("aria-expanded")) !== "true") {
        await section.click();
      }
      await expect(section).toHaveAttribute("aria-expanded", "true");
    };

    await page.goto("/");
    await page.evaluate((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.reload();
    await page.getByRole("button", { name: "Chat Settings" }).click();
    const drawer = page.locator(".mari-chat-settings-drawer");
    await openAgentsSection(drawer);
    await expect(drawer.getByText("Custom Agents", { exact: true })).toBeVisible();
    await drawer.getByRole("button", { name: /Custom Agents/ }).click();
    await drawer.getByRole("button").filter({ hasText: agentName }).click();
    const addDialog = page.getByRole("dialog");
    await expect(addDialog.getByRole("heading", { name: `Add ${agentName}` })).toBeVisible();
    await addDialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect.poll(readAgentState).toEqual({ enabled: true, active: true });

    await page.reload();
    await page.getByRole("button", { name: "Chat Settings" }).click();
    const reloadedDrawer = page.locator(".mari-chat-settings-drawer");
    await openAgentsSection(reloadedDrawer);
    await expect(reloadedDrawer.getByText(agentName, { exact: true }).first()).toBeVisible();
    const customAgentSection = reloadedDrawer.getByRole("button", { name: "Collapse Custom Agents" });
    await expect(customAgentSection).toHaveAttribute("aria-expanded", "true");
    await customAgentSection.click();
    await expect(reloadedDrawer.getByRole("button", { name: "Expand Custom Agents" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(reloadedDrawer.getByText(agentName, { exact: true })).toHaveCount(0);
    await expect.poll(readAgentState).toEqual({ enabled: true, active: true });
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
    if (agentId) await request.delete(`/api/agents/${agentId}`);
  }
});

test("Secret Plot run interval stays editable across repeated commits", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Secret Plot interval editing is covered on desktop.");

  let chatId: string | undefined;
  try {
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Secret Plot Interval Smoke", mode: "roleplay", characterIds: [] },
    });
    expect(chatResponse.ok()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string };
    chatId = chat.id;
    const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        enableAgents: true,
        activeAgentIds: ["director"],
        narrativeDirectorSecretPlotEnabled: true,
        narrativeDirectorSecretPlotRunInterval: 8,
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();

    const readRunInterval = async () => {
      const response = await request.get(`/api/chats/${chat.id}`);
      if (!response.ok()) return null;
      const current = (await response.json()) as { metadata?: unknown };
      const metadata =
        typeof current.metadata === "string"
          ? (JSON.parse(current.metadata) as Record<string, unknown>)
          : ((current.metadata ?? {}) as Record<string, unknown>);
      return metadata.narrativeDirectorSecretPlotRunInterval;
    };

    await page.route("**/api/capability-packages/agents", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "director",
            name: "Narrative Director",
            description: "Creates one-shot story directions.",
            author: "Pasta Devs",
            phase: "pre_generation",
            execution: "host",
            enabledByDefault: false,
            category: "writer",
            modeAllowlist: ["roleplay"],
            defaultPromptTemplate: "Return the next story direction.",
          },
        ]),
      });
    });
    await page.route("**/api/capability-packages/installed", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.route("**/api/agents", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);

    await page.goto("/");
    await page.getByRole("button", { name: "Chat Settings" }).click();
    const drawer = page.locator(".mari-chat-settings-drawer");
    const agentsSection = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents/ });
    if ((await agentsSection.getAttribute("aria-expanded")) !== "true") await agentsSection.click();

    const directorCard = drawer.locator(`#chat-settings-agent-menu-${chat.id}-director`);
    const intervalInput = directorCard.locator("label").filter({ hasText: "Run Interval" }).locator("input");
    await expect(intervalInput).toHaveValue("8");

    await intervalInput.fill("3");
    await intervalInput.blur();
    await expect.poll(readRunInterval).toBe(3);
    await expect(intervalInput).toHaveValue("3");

    await intervalInput.fill("11");
    await intervalInput.press("Enter");
    await expect.poll(readRunInterval).toBe(11);
    await expect(intervalInput).toHaveValue("11");

    await intervalInput.fill("0");
    await intervalInput.blur();
    await expect.poll(readRunInterval).toBe(1);
    await expect(intervalInput).toHaveValue("1");

    await intervalInput.fill("101");
    await intervalInput.press("Enter");
    await expect.poll(readRunInterval).toBe(100);
    await expect(intervalInput).toHaveValue("100");

    await page.reload();
    await page.getByRole("button", { name: "Chat Settings" }).click();
    const reloadedDrawer = page.locator(".mari-chat-settings-drawer");
    const reloadedAgentsSection = reloadedDrawer
      .locator('[role="button"][aria-expanded]')
      .filter({ hasText: /^Agents/ });
    if ((await reloadedAgentsSection.getAttribute("aria-expanded")) !== "true") {
      await reloadedAgentsSection.click();
    }
    await expect(
      reloadedDrawer
        .locator(`#chat-settings-agent-menu-${chat.id}-director`)
        .locator("label")
        .filter({ hasText: "Run Interval" })
        .locator("input"),
    ).toHaveValue("100");
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`, { timeout: 10_000 });
  }
});

test("mobile Roleplay code formatting stays inside the message width", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile markdown containment regression.");

  const longCode = "unbroken_mobile_code_".repeat(20);
  let chatId: string | null = null;

  try {
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Mobile Markdown Containment Smoke", mode: "roleplay", characterIds: [] },
    });
    expect(chatResponse.ok()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string };
    chatId = chat.id;

    const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: `Inline \`${longCode}\`\n\n\`\`\`text\n${longCode}\n\`\`\``,
      },
    });
    expect(messageResponse.ok()).toBeTruthy();
    const message = (await messageResponse.json()) as { id: string };

    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");
    const content = page.locator(`[data-message-id="${message.id}"] .mari-message-content`).first();
    await expect(content.locator(".mari-md-inline-code")).toBeVisible();
    await expect(content.locator(".mari-md-codeblock")).toBeVisible();
    const bounds = await content.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        left: rect.left,
        right: rect.right,
        scrollWidth: element.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      };
    });
    expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth + 1);
    expect(bounds.left).toBeGreaterThanOrEqual(-1);
    expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`);
  }
});

test("Roleplay and Game chat settings link empty agent libraries to Download Agents", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Empty Chat Settings agent libraries are covered on desktop.");
  test.setTimeout(90_000);

  const errors = collectUnexpectedErrors(page);
  const chats: Array<{ id: string; mode: "roleplay" | "game" }> = [];
  const fixtureNames = new Set(["roleplay Empty Agent Settings Smoke", "game Empty Agent Settings Smoke"]);
  const existingChatsResponse = await page.request.get("/api/chats");
  const existingChats = (await existingChatsResponse.json()) as Array<{ id: string; name: string }>;
  await Promise.all(
    existingChats
      .filter((chat) => fixtureNames.has(chat.name))
      .map((chat) => page.request.delete(`/api/chats/${chat.id}`)),
  );
  for (const mode of ["roleplay", "game"] as const) {
    const response = await page.request.post("/api/chats", {
      data: { name: `${mode} Empty Agent Settings Smoke`, mode, characterIds: [] },
    });
    expect(response.ok()).toBeTruthy();
    const chat = (await response.json()) as { id: string };
    if (mode === "game") {
      const metadataResponse = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
        data: {
          gameId: "empty-agent-settings-smoke-game",
          gameSessionStatus: "active",
          gameSessionNumber: 1,
          gameIntroPresented: true,
        },
      });
      expect(metadataResponse.ok()).toBeTruthy();
      const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "The party arrives at the test crossroads." },
      });
      expect(messageResponse.ok()).toBeTruthy();
    }
    chats.push({ id: chat.id, mode });
  }

  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-14T00:00:00.000Z", packages: [] }),
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/lorebooks/scan/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 }),
    });
  });
  await page.route("**/api/game-assets/manifest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ scannedAt: "2026-07-14T00:00:00.000Z", count: 0, assets: {}, byCategory: {} }),
    });
  });
  await page.route("**/api/backgrounds/file/Black.jpg**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
    });
  });

  try {
    await page.goto("/");
    for (const chat of chats) {
      await page.evaluate((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
      await page.reload();
      await page.getByRole("button", { name: "Chat Settings" }).click();
      const drawer = page.locator(".mari-chat-settings-drawer");
      await expect(drawer, `${chat.mode} Chat Settings drawer should open`).toBeVisible();
      const sectionLabels = await drawer.locator('[role="button"][aria-expanded]').allTextContents();
      expect(
        sectionLabels.some((label) => label.startsWith("Agents")),
        `${chat.mode} Chat Settings sections`,
      ).toBeTruthy();
      const agentsSection = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents/ });
      await agentsSection.click();
      await expect(drawer.getByText("No agents downloaded yet.", { exact: true })).toBeVisible();
      await drawer.getByRole("button", { name: "Download Agents", exact: true }).click();
      const catalog = page.locator('[data-component="AgentCatalogView"]');
      await expect(catalog).toBeVisible();
      await expect(page.locator('[data-component="RightPanelDesktop"]')).toBeVisible();
      await catalog.getByRole("button", { name: "Back to Agents" }).click();
      await expect(catalog).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat.id}`, { timeout: 10_000 })));
  }
});

test("Illustrator owns the merged scene-video and Storyboard subsections while agent removal stays away from collapse", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Illustrator agent card hierarchy is covered on desktop.");
  test.setTimeout(90_000);

  const errors = collectUnexpectedErrors(page);
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Roleplay Illustrator Agent Card Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const gameChatResponse = await request.post("/api/chats", {
    data: { name: "Game Illustrator Subsections Smoke", mode: "game", characterIds: [] },
  });
  expect(gameChatResponse.ok()).toBeTruthy();
  const gameChat = (await gameChatResponse.json()) as { id: string };
  const gameMetadataResponse = await request.patch(`/api/chats/${gameChat.id}/metadata`, {
    data: {
      gameId: "illustrator-subsections-smoke-game",
      gameSessionStatus: "active",
      gameSessionNumber: 1,
      gameIntroPresented: true,
      enableAgents: true,
      activeAgentIds: ["illustrator", "storyboard"],
      enableSpriteGeneration: true,
      gameSceneVideosEnabled: false,
    },
  });
  expect(gameMetadataResponse.ok()).toBeTruthy();
  const gameMessageResponse = await request.post(`/api/chats/${gameChat.id}/messages`, {
    data: { role: "assistant", content: "The Illustrator subsection smoke campaign begins." },
  });
  expect(gameMessageResponse.ok()).toBeTruthy();
  const illustratorManifest = {
    id: "illustrator",
    name: "Illustrator",
    description: "Generates visual scene prompts and images.",
    author: "Pasta Devs",
    phase: "post_processing",
    execution: "feature",
    enabledByDefault: false,
    category: "misc",
    modeAllowlist: ["roleplay", "game"],
    defaultPromptTemplate: "Return a scene image prompt.",
  };
  const storyboardManifest = {
    id: "storyboard",
    name: "Storyboard",
    description: "Plans still and animated Game keyframes.",
    author: "Pasta Devs",
    phase: "post_processing",
    execution: "host",
    enabledByDefault: false,
    category: "misc",
    modeAllowlist: ["game"],
    defaultPromptTemplate: "Plan storyboard keyframes.",
  };

  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([illustratorManifest, storyboardManifest]),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/lorebooks/scan/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 }),
    });
  });
  await page.route("**/api/backgrounds/file/Black.jpg**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
    });
  });

  const openAgentsSection = async () => {
    await page.getByRole("button", { name: "Chat Settings" }).click();
    const drawer = page.locator(".mari-chat-settings-drawer");
    const section = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents/ });
    if ((await section.getAttribute("aria-expanded")) !== "true") await section.click();
    await expect(section).toHaveAttribute("aria-expanded", "true");
    return drawer;
  };

  try {
    await page.addInitScript((chatId) => {
      if (sessionStorage.getItem("illustrator-subsections-chat-seeded")) return;
      localStorage.setItem("marinara-active-chat-id", chatId);
      sessionStorage.setItem("illustrator-subsections-chat-seeded", "true");
    }, chat.id);
    await page.goto("/");
    let drawer = await openAgentsSection();
    await expect(drawer.getByText("Scene Videos", { exact: true })).toHaveCount(0);

    const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { enableAgents: true, activeAgentIds: ["illustrator"] },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    await page.reload();
    drawer = await openAgentsSection();

    const illustratorCard = drawer.locator(`#chat-settings-agent-menu-${chat.id}-illustrator`);
    await expect(illustratorCard).toBeVisible();
    const sceneVideosSubsection = illustratorCard.locator('[data-agent-settings-subsection="scene-videos"]');
    await expect(sceneVideosSubsection).toBeVisible();
    await expect(sceneVideosSubsection.getByRole("heading", { name: "Scene Videos" })).toBeVisible();
    await expect(sceneVideosSubsection.locator("[data-agent-settings-subsection-header] > svg")).toHaveCount(0);

    const collapseButton = illustratorCard.getByRole("button", { name: "Collapse Illustrator" });
    const cardToggle = illustratorCard.locator("button[aria-controls][aria-expanded]");
    const removeButton = illustratorCard.getByRole("button", { name: "Remove Illustrator from chat" });
    const assertRemoveAtBottomRight = async () => {
      const [cardBox, collapseBox, removeBox] = await Promise.all([
        illustratorCard.boundingBox(),
        cardToggle.boundingBox(),
        removeButton.boundingBox(),
      ]);
      expect(cardBox).not.toBeNull();
      expect(collapseBox).not.toBeNull();
      expect(removeBox).not.toBeNull();
      expect(removeBox!.y).toBeGreaterThanOrEqual(collapseBox!.y + collapseBox!.height);
      expect(Math.abs(cardBox!.x + cardBox!.width - 12 - (removeBox!.x + removeBox!.width))).toBeLessThanOrEqual(2);
      expect(Math.abs(cardBox!.y + cardBox!.height - 12 - (removeBox!.y + removeBox!.height))).toBeLessThanOrEqual(2);
    };
    await assertRemoveAtBottomRight();
    await collapseButton.click();
    const expandButton = illustratorCard.getByRole("button", { name: "Expand Illustrator" });
    await expect(expandButton).toHaveAttribute("aria-expanded", "false");
    await expect(removeButton).toHaveCount(0);

    await page.evaluate((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), gameChat.id);
    await page.reload();
    drawer = await openAgentsSection();

    const gameIllustratorCard = drawer.locator(`#chat-settings-agent-menu-${gameChat.id}-illustrator`);
    const featureToggles = gameIllustratorCard.locator('[data-agent-settings-feature-toggles="illustrator"]');
    const storyboardFeatureToggles = gameIllustratorCard.locator('[data-agent-settings-feature-toggles="storyboard"]');
    const sceneVideosToggle = featureToggles.getByRole("checkbox", { name: /Enable Scene Videos/ });
    const storyboardsToggle = storyboardFeatureToggles.getByRole("checkbox", { name: /Enable Storyboards/ });
    await expect(gameIllustratorCard).toBeVisible();
    await expect(sceneVideosToggle).not.toBeChecked();
    await expect(storyboardsToggle).toBeChecked();
    await expect(gameIllustratorCard.locator('[data-agent-settings-subsection="scene-videos"]')).toHaveCount(0);
    const storyboardsSubsection = gameIllustratorCard.locator('[data-agent-settings-subsection="storyboards"]');
    await expect(storyboardsSubsection).toBeVisible();
    await expect(storyboardsSubsection.getByRole("heading", { name: "Storyboards" })).toBeVisible();
    await expect(
      storyboardsSubsection.getByRole("checkbox", { name: /Automatic Storyboard Illustrations/ }),
    ).toBeChecked();
    const automaticAnimationsToggle = storyboardsSubsection.getByRole("checkbox", {
      name: /Automatic Storyboard Animations/,
    });
    await expect(automaticAnimationsToggle).not.toBeChecked();
    const keyframeSlider = storyboardsSubsection.getByRole("slider", { name: "Keyframes per Turn" });
    const keyframeControl = storyboardsSubsection
      .locator("label")
      .filter({ hasText: "Keyframes per Turn" })
      .locator("..");
    await expect(keyframeSlider).toHaveValue("3");
    await keyframeSlider.fill("5");
    await expect(keyframeSlider).toHaveValue("5");
    await keyframeControl.getByRole("button", { name: "Use agent default" }).click();
    await expect(keyframeSlider).toHaveValue("3");
    await expect(keyframeControl.getByText("Using agent default", { exact: true })).toBeVisible();
    const durationInput = storyboardsSubsection.getByRole("spinbutton", { name: "Animation Clip Duration" });
    const durationControl = storyboardsSubsection
      .locator("label")
      .filter({ hasText: "Animation Clip Duration" })
      .locator("..");
    await expect(durationInput).toBeDisabled();
    await storyboardsSubsection.getByText("Automatic Storyboard Animations", { exact: true }).click();
    await expect(automaticAnimationsToggle).toBeChecked();
    await expect(durationInput).toBeEnabled();
    await durationInput.fill("9");
    await durationInput.blur();
    await expect(durationInput).toHaveValue("9");
    await durationControl.getByRole("button", { name: "Use agent default" }).click();
    await expect(durationInput).toHaveValue("6");
    await expect(durationControl.getByText("Using agent default", { exact: true })).toBeVisible();
    await expect(gameIllustratorCard.getByText("Attach Card Appearance", { exact: true })).toHaveCount(1);
    await expect(gameIllustratorCard.getByText("Send Avatar References", { exact: true })).toHaveCount(1);

    await featureToggles.getByText("Enable Scene Videos", { exact: true }).click();
    const gameSceneVideosSubsection = gameIllustratorCard.locator('[data-agent-settings-subsection="scene-videos"]');
    await expect(sceneVideosToggle).toBeChecked();
    await expect(gameSceneVideosSubsection).toBeVisible();
    await expect(gameSceneVideosSubsection.getByRole("heading", { name: "Scene Videos" })).toBeVisible();
    await expect(gameSceneVideosSubsection.locator("[data-agent-settings-subsection-header] > svg")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await Promise.all([chat.id, gameChat.id].map((chatId) => request.delete(`/api/chats/${chatId}`)));
  }
});

test("World Maps stays in Agents and Chat Settings", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Hierarchical Maps agent placement is covered on desktop.");
  test.setTimeout(90_000);

  const errors = collectUnexpectedErrors(page);
  const chats: Array<{ id: string; mode: "roleplay" | "game" }> = [];
  for (const mode of ["roleplay", "game"] as const) {
    const response = await request.post("/api/chats", {
      data: { name: `${mode} Hierarchical Maps Agent Menu Smoke`, mode, characterIds: [] },
    });
    expect(response.ok()).toBeTruthy();
    const chat = (await response.json()) as { id: string };
    const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        enableAgents: true,
        activeAgentIds: ["hierarchical-maps"],
        ...(mode === "game"
          ? {
              gameId: "hierarchical-maps-agent-menu-smoke",
              gameSessionStatus: "active",
              gameSessionNumber: 1,
              gameIntroPresented: true,
            }
          : {}),
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();
    if (mode === "game") {
      const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "The party studies the map." },
      });
      expect(messageResponse.ok()).toBeTruthy();
    }
    chats.push({ id: chat.id, mode });
  }

  const agentManifest = {
    id: "hierarchical-maps",
    name: "Hierarchical Maps",
    description: "Adds persistent hierarchical locations and spatial context.",
    author: "Pasta Devs",
    phase: "pre_generation",
    enabledByDefault: false,
    category: "tracker",
    runtimeDisabled: true,
    modeAllowlist: ["roleplay", "game"],
    defaultPromptTemplate: "",
    execution: "feature",
  };
  const packageManifest = {
    schemaVersion: 1,
    id: "hierarchical-maps",
    name: "Hierarchical Maps",
    version: "1.0.6",
    description: agentManifest.description,
    engine: { min: "2.3.0", maxExclusive: "2.4.0" },
    kind: ["agent", "maps"],
    entrypoints: { agents: "agents.json", client: "client.js" },
    contributions: {
      slots: ["chat-settings", "spatial-workspace", "chat-runtime", "game-world-map"],
      agentDetail: { agentIds: ["hierarchical-maps"] },
    },
    files: [],
    permissions: ["ui"],
    restartRequired: true,
  };

  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([agentManifest]) });
  });
  await page.route("**/api/capability-packages/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ schemaVersion: 1, generatedAt: "2026-07-16T00:00:00.000Z", packages: [] }),
    });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "hierarchical-maps",
          version: packageManifest.version,
          manifest: packageManifest,
          installedAt: "2026-07-16T00:00:00.000Z",
          status: "active",
          error: null,
          legacy: false,
        },
      ]),
    });
  });
  await page.route("**/api/capability-packages/hierarchical-maps/client?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        class HierarchicalMapsSmokeElement extends HTMLElement {
          connectedCallback() {
            this.addEventListener('marinara-capability-props', () => this.render());
            this.render();
          }
          render() {
            const props = this.capabilityProps || {};
            if (this.getAttribute('view') === 'detail') {
              this.innerHTML = '<section data-testid="hierarchical-maps-detail"><h1>Hierarchical Maps home</h1><p>' + (props.chatName || 'No current chat') + '</p><button type="button">Back to Agents</button></section>';
              this.querySelector('button')?.addEventListener('click', () => props.onClose?.());
              return;
            }
            this.innerHTML = '<div data-testid="hierarchical-maps-controls">Hierarchical map controls</div>';
          }
        }
        if (!customElements.get('marinara-capability-hierarchical-maps')) {
          customElements.define('marinara-capability-hierarchical-maps', HierarchicalMapsSmokeElement);
        }
        export {};
      `,
    });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/lorebooks/scan/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [], budgetSkippedEntries: [], totalTokens: 0, totalEntries: 0 }),
    });
  });
  await page.route("**/api/chats/*/spatial-context", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        definition: null,
        currentLocationId: null,
        breadcrumb: [],
        destinations: [],
        warnings: [],
        hasCommittedSpatialHistory: false,
      }),
    });
  });
  await page.route("**/api/game-assets/manifest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ scannedAt: "2026-07-16T00:00:00.000Z", count: 0, assets: {}, byCategory: {} }),
    });
  });
  await page.route("**/api/backgrounds/file/Black.jpg**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
    });
  });

  try {
    await page.addInitScript((chatId) => {
      if (sessionStorage.getItem("maps-feature-detail-chat-seeded")) return;
      localStorage.setItem("marinara-active-chat-id", chatId);
      sessionStorage.setItem("maps-feature-detail-chat-seeded", "true");
    }, chats[0]!.id);
    await page.goto("/");
    await expect(page.locator('[data-tour="world-maps"]')).toHaveCount(0);
    await expect(page.locator('[data-component="ChatSidebar"] button[aria-label="World Maps"]')).toHaveCount(0);

    await page.locator('[data-tour="panel-agents"]').click();
    await expect(page.locator('[data-tour="panel-agents"]')).toHaveClass(/mari-topbar-panel-icon--active/);

    const agentsPanel = page.locator('[data-component="RightPanelDesktop"]');
    const mapsCard = agentsPanel.locator('[data-agent-name="Hierarchical Maps"]');
    await expect(mapsCard).toBeVisible();
    await mapsCard.getByText("Hierarchical Maps", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Hierarchical Maps home" })).toBeVisible();
    await expect(page.getByTestId("hierarchical-maps-detail")).toContainText(
      "roleplay Hierarchical Maps Agent Menu Smoke",
    );
    await expect(page.getByText("System Prompt", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Back to Agents" }).click();
    await expect(page.getByTestId("hierarchical-maps-detail")).toHaveCount(0);
    await expect(page.locator('[data-tour="panel-agents"]')).toHaveClass(/mari-topbar-panel-icon--active/);

    for (const chat of chats) {
      await page.evaluate((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
      await page.reload();
      await page.getByRole("button", { name: "Chat Settings" }).click();
      const drawer = page.locator(".mari-chat-settings-drawer");
      await expect(drawer).toBeVisible();
      await expect(
        drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Hierarchical map/ }),
        `${chat.mode} should not expose a top-level Hierarchical map section`,
      ).toHaveCount(0);

      const agentsSection = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents/ });
      await agentsSection.click();
      if (chat.mode === "roleplay") {
        const mapsMenuLink = drawer.locator('button[title="Jump to Hierarchical Maps"]');
        await expect(mapsMenuLink).toBeVisible();
        await mapsMenuLink.click();
      } else {
        await expect(drawer.locator('button[title="Jump to Hierarchical Maps"]')).toHaveCount(0);
      }

      const agentEntry = drawer.locator('[data-chat-agent-entry="hierarchical-maps"]');
      await expect(agentEntry, `${chat.mode} Hierarchical Maps agent entry`).toBeVisible();
      if (chat.mode === "roleplay") await expect(agentEntry).toBeFocused();
      await expect(agentEntry.getByTestId("hierarchical-maps-controls")).toBeVisible();
      await expect(drawer.locator("marinara-capability-hierarchical-maps")).toHaveCount(1);
      await expect(agentEntry.locator("marinara-capability-hierarchical-maps")).toHaveCount(1);

      if (chat.mode === "game") {
        await expect(drawer.getByText("Scene Videos", { exact: true })).toHaveCount(0);
        await expect(drawer.getByText("Storyboards", { exact: true })).toHaveCount(0);
        await page.locator('[data-chat-toolbar-panel-action="settings"]').click();
        await expect(drawer).toHaveCount(0);
        const mapPanel = page.locator('[data-tour="game-map"]:visible').first();
        const narrationPanel = page.locator('[data-component="GameNarration.ActivePanel"]');
        await expect(mapPanel).toBeVisible();
        await expect(narrationPanel).toBeVisible();
        const [mapBackground, narrationBackground] = await Promise.all([
          mapPanel.evaluate((element) => getComputedStyle(element).backgroundColor),
          narrationPanel.evaluate((element) => getComputedStyle(element).backgroundColor),
        ]);
        expect(mapBackground).toBe(narrationBackground);
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat.id}`, { timeout: 10_000 })));
  }
});

test("Roleplay setup points empty agent libraries to the Agents tab", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Roleplay setup empty-state regression is covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  const beforeResponse = await request.get("/api/chats");
  const beforeChats = (await beforeResponse.json()) as Array<{ id: string }>;
  const existingChatIds = new Set(beforeChats.map((chat) => chat.id));
  const connectionResponse = await request.post("/api/connections", {
    data: { name: `Roleplay Setup Smoke ${Date.now()}`, provider: "custom" },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  await page.route("**/api/capability-packages/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/capability-packages/installed", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/agents", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.route("**/api/backgrounds/file/Black.jpg**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/gif",
      body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
    });
  });

  try {
    await page.goto("/");
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await page.locator('[data-tour="chat-mode-roleplay"]').click();
    await page.getByLabel("New Roleplay").click();
    const connectionGate = page.getByRole("heading", { name: "Set Up Roleplay", exact: true });
    const wizardHeading = page.getByRole("heading", { name: "New Roleplay", exact: true });
    await expect(connectionGate.or(wizardHeading)).toBeVisible();
    if (await connectionGate.isVisible()) {
      await page.getByRole("button", { name: "Create Chat", exact: true }).click();
    }
    await expect(wizardHeading).toBeVisible();
    const nextButton = page.getByRole("button", { name: "Next", exact: true });
    await nextButton.click();
    await expect(page.getByRole("heading", { name: "Pick a Preset", exact: true })).toBeVisible();
    await nextButton.click();
    const participantsHeading = page.getByRole("heading", { name: "Persona & Characters", exact: true });
    const choiceDialog = page.getByRole("dialog", { name: "Configure Preset Variables" });
    await expect(choiceDialog.or(participantsHeading).first()).toBeVisible();
    if (await choiceDialog.isVisible()) {
      await choiceDialog.getByRole("button", { name: "Skip", exact: true }).click();
    }
    await expect(participantsHeading).toBeVisible();
    await nextButton.click();
    await expect(page.getByRole("heading", { name: "Attach Lorebooks", exact: true })).toBeVisible();
    await nextButton.click();
    const agentsStepHeading = page.getByRole("heading", { name: "Enable Agents", exact: true });
    await expect(agentsStepHeading).toBeVisible();
    await expect(
      page.getByText("No agents downloaded yet. Head to Agents tab and click Download Agents to get some!"),
    ).toBeVisible();
    await expect(
      page.locator('[data-component="ChatSetupWizard.AgentEmptyState"] .mari-panel-gradient--agents'),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Open Agents tab" }).click();
    await expect(page.locator('[data-component="RightPanelDesktop"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Download Agents" })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    const afterResponse = await request.get("/api/chats");
    const afterChats = (await afterResponse.json()) as Array<{ id: string }>;
    await Promise.all(
      afterChats.filter((chat) => !existingChatIds.has(chat.id)).map((chat) => request.delete(`/api/chats/${chat.id}`)),
    );
    await request.delete(`/api/connections/${connection.id}`, { timeout: 10_000 });
  }
});

test("desktop resource editors open beside their source sidebars", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop side-by-side editor behavior.");
  await page.setViewportSize({ width: 1360, height: 900 });

  const suffix = Date.now().toString(36);
  const createResource = async (path: string, data: Record<string, unknown>) => {
    const response = await page.request.post(path, { data });
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as { id: string };
  };
  const characterName = `Sidebar Character ${suffix}`;
  const lorebookName = `Sidebar Lorebook ${suffix}`;
  const presetName = `Sidebar Preset ${suffix}`;
  const connectionName = `Sidebar Connection ${suffix}`;
  const agentName = `Sidebar Agent ${suffix}`;
  const personaName = `Sidebar Persona ${suffix}`;
  const character = await createResource("/api/characters", { data: { name: characterName } });
  const lorebook = await createResource("/api/lorebooks", {
    name: lorebookName,
    description: "Desktop sidebar regression fixture.",
    category: "world",
    enabled: true,
  });
  const preset = await createResource("/api/prompts", {
    name: presetName,
    description: "Desktop sidebar regression fixture.",
  });
  const connection = await createResource("/api/connections", {
    name: connectionName,
    provider: "custom",
  });
  const agent = await createResource("/api/agents", {
    type: `sidebar-agent-${suffix}`,
    name: agentName,
    description: "Desktop sidebar regression fixture.",
    phase: "post_processing",
  });
  const persona = await createResource("/api/characters/personas", {
    name: personaName,
    description: "Desktop sidebar regression fixture.",
  });

  const resources = [
    { panel: "characters", name: characterName },
    { panel: "lorebooks", name: lorebookName },
    { panel: "presets", name: presetName },
    { panel: "connections", name: connectionName },
    { panel: "agents", name: agentName },
    { panel: "personas", name: personaName },
  ];

  try {
    await page.goto("/");
    await page.locator('[data-tour="sidebar-toggle"]').click();
    const chatSidebar = page.locator('[data-component="ChatSidebarPanel"]');
    const resourceSidebar = page.locator('[data-component="RightPanelDesktop"]');
    const centerContent = page.locator('[data-component="CenterContent"]');
    await expect(chatSidebar).toBeVisible();

    for (const resource of resources) {
      await page.locator(`[data-tour="panel-${resource.panel}"]`).click();
      await expect(resourceSidebar).toBeVisible();
      await expect(centerContent).toHaveAttribute("data-center-compact", "true");
      const resourceRow = resourceSidebar.getByText(resource.name, { exact: true }).first();
      await expect(resourceRow).toBeVisible();
      await resourceRow.evaluate((element) => (element as HTMLElement).click());

      const editor = centerContent.locator(".mari-editor-shell");
      await expect(editor).toBeVisible();
      await expect(resourceSidebar).toBeVisible();
      await expect(chatSidebar).toBeVisible();
      await expect(resourceSidebar.getByText(resource.name, { exact: true }).first()).toBeVisible();

      await editor.locator(".mari-editor-header .mari-editor-action").first().click();
      await expect(editor).toHaveCount(0);
    }
  } finally {
    if (!page.isClosed()) {
      await Promise.all([
        page.request.delete(`/api/characters/${character.id}`),
        page.request.delete(`/api/lorebooks/${lorebook.id}`),
        page.request.delete(`/api/prompts/${preset.id}`),
        page.request.delete(`/api/connections/${connection.id}`),
        page.request.delete(`/api/agents/${agent.id}`),
        page.request.delete(`/api/characters/personas/${persona.id}`),
      ]);
    }
  }
});

test("desktop Connections and Lorebooks folders expand without a React hook error", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop right-sidebar folder regression.");
  await page.setViewportSize({ width: 1360, height: 900 });

  const suffix = Date.now().toString(36);
  const connectionName = `Folder Connection ${suffix}`;
  const connectionFolderName = `Connection Folder ${suffix}`;
  const lorebookName = `Folder Lorebook ${suffix}`;
  const lorebookFolderName = `Lorebook Folder ${suffix}`;
  const connectionResponse = await page.request.post("/api/connections", {
    data: { name: connectionName, provider: "custom" },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  const connectionFolderResponse = await page.request.post("/api/connection-folders", {
    data: { name: connectionFolderName },
  });
  expect(connectionFolderResponse.ok()).toBeTruthy();
  const connectionFolder = (await connectionFolderResponse.json()) as { id: string };
  expect(
    (
      await page.request.post("/api/connection-folders/move-connection", {
        data: { connectionId: connection.id, folderId: connectionFolder.id },
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await page.request.patch(`/api/connection-folders/${connectionFolder.id}`, {
        data: { collapsed: true },
      })
    ).ok(),
  ).toBeTruthy();

  const lorebookResponse = await page.request.post("/api/lorebooks", {
    data: {
      name: lorebookName,
      description: "Folder expansion regression fixture.",
      category: "world",
      enabled: true,
    },
  });
  expect(lorebookResponse.ok()).toBeTruthy();
  const lorebook = (await lorebookResponse.json()) as { id: string };
  await page.addInitScript(
    ({ folderName, lorebookId }) => {
      const now = new Date().toISOString();
      localStorage.setItem(
        "marinara-library-folders-v1",
        JSON.stringify([
          {
            id: "folder-expansion-regression",
            scope: "lorebooks",
            name: folderName,
            collapsed: true,
            sortOrder: 0,
            itemIds: [lorebookId],
            createdAt: now,
            updatedAt: now,
          },
        ]),
      );
    },
    { folderName: lorebookFolderName, lorebookId: lorebook.id },
  );

  const errors = collectUnexpectedErrors(page);
  try {
    await page.goto("/");

    await page.locator('[data-tour="panel-connections"]').click();
    const resourceSidebar = page.locator('[data-component="RightPanelDesktop"]');
    const connectionFolderToggle = resourceSidebar.locator(
      `[data-connection-folder-id="${connectionFolder.id}"] > [role="button"]`,
    );
    await expect(connectionFolderToggle).toBeVisible();
    await connectionFolderToggle.click();
    await expect(connectionFolderToggle).toHaveAttribute("aria-expanded", "true");
    await expect(resourceSidebar.getByText(connectionName, { exact: true })).toBeVisible();

    await page.locator('[data-tour="panel-lorebooks"]').click();
    const lorebookFolderToggle = resourceSidebar.locator(
      '[data-lorebook-folder-id="folder-expansion-regression"] > [role="button"]',
    );
    await expect(lorebookFolderToggle).toBeVisible();
    await lorebookFolderToggle.click();
    await expect(lorebookFolderToggle).toHaveAttribute("aria-expanded", "true");
    await expect(resourceSidebar.getByText(lorebookName, { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    if (!page.isClosed()) {
      await Promise.all([
        page.request.delete(`/api/connections/${connection.id}`),
        page.request.delete(`/api/connection-folders/${connectionFolder.id}`),
        page.request.delete(`/api/lorebooks/${lorebook.id}`),
      ]);
    }
  }
});

test("Professor Mari chat fills the mobile home viewport and keeps its composer visible", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Professor Mari mobile viewport regression.");
  await page.goto("/");

  await page
    .locator('[data-component="HomeProfessorMariChat.MariPanel"]')
    .getByRole("button", { name: "Ask Professor Mari" })
    .click();

  const topBar = page.locator('[data-component="TopBar"]');
  const window = page.locator('[data-component="HomeProfessorMariChat.Window"]');
  const composer = window.getByPlaceholder("Ask Professor Mari");
  await expect(window).toBeVisible();
  await expect(composer).toBeVisible();
  await expect
    .poll(async () => {
      const [topBarBox, windowBox, composerBox] = await Promise.all([
        topBar.boundingBox(),
        window.boundingBox(),
        composer.boundingBox(),
      ]);
      const viewport = page.viewportSize();
      if (!topBarBox || !windowBox || !composerBox || !viewport) return false;
      const contentTop = topBarBox.y + topBarBox.height;
      return (
        Math.abs(windowBox.y - contentTop) <= 1 &&
        Math.abs(windowBox.y + windowBox.height - viewport.height) <= 1 &&
        composerBox.y + composerBox.height <= viewport.height + 1
      );
    })
    .toBe(true);
});

test("Professor Mari bulk chat deletion follows the active accent", async ({ page }) => {
  const firstResponse = await page.request.get("/api/chats/internal/professor-mari");
  expect(firstResponse.ok()).toBeTruthy();
  const firstChat = (await firstResponse.json()) as { id: string };
  const secondResponse = await page.request.post("/api/chats/internal/professor-mari/restart");
  expect(secondResponse.ok()).toBeTruthy();
  const secondChat = (await secondResponse.json()) as { id: string };

  try {
    await page.goto("/");
    await setAppAccentColor(page, "#14b8a6");
    const activeAccentColor = await readCssVariableColor(page, "--marinara-chat-chrome-button-text-active");
    await page
      .locator('[data-component="HomeProfessorMariChat.MariPanel"]')
      .getByRole("button", { name: "Ask Professor Mari" })
      .click();

    const window = page.locator('[data-component="HomeProfessorMariChat.Window"]');
    await window.getByRole("button", { name: "Chats" }).click();
    await window.getByRole("button", { name: "Select", exact: true }).click();
    await window
      .locator(`[data-professor-mari-chat-id="${firstChat.id}"]`)
      .getByRole("button", { name: /Professor Mari/u })
      .click();

    const deleteSelected = window.getByRole("button", { name: "Delete selected" });
    await expect(deleteSelected).toBeEnabled();
    await expect(deleteSelected).toHaveClass(/mari-chrome-control--primary/u);
    await expect(deleteSelected).toHaveCSS("color", activeAccentColor);
    expect(await deleteSelected.getAttribute("class")).not.toMatch(/danger|destructive|pink|red|rose/iu);
  } finally {
    await Promise.all(
      [firstChat.id, secondChat.id].map((id) =>
        page.request.delete(`/api/chats/internal/professor-mari/chats/${id}`).catch(() => undefined),
      ),
    );
  }
});

test("Professor Mari dependency and sensitive-file reviews stay explicit across viewports", async ({ page }) => {
  await page.route("**/api/professor-mari/workspace/status*", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        enabled: true,
        piAvailable: false,
        workspace: "/tmp/marinara",
        dataDir: "/tmp/marinara/data",
        tools: ["read", "grep", "find", "ls", "edit", "write", "bash", "dependency", "app_data"],
        shellSandbox: { available: true, backend: "macos-seatbelt" },
        dbAccess: "server-managed",
        connection: null,
        skills: [],
        skillDiagnostics: [],
        active: false,
        pendingApprovals: [
          {
            kind: "dependency_install",
            id: "dependency-review-e2e",
            sessionId: "e2e",
            packageName: "nanoid",
            version: "5.1.11",
            target: "server",
            dependencyType: "dependency",
            integrity: "sha512-regression-integrity",
            tarballUrl: "https://registry.npmjs.org/nanoid/-/nanoid-5.1.11.tgz",
            directDependencies: [],
            reason: "Generate stable local IDs.",
            requestedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
          {
            kind: "sensitive_file",
            id: "file-review-e2e",
            sessionId: "e2e",
            path: "package.json",
            changeType: "update",
            beforeHash: "sha256:before",
            afterHash: "sha256:after",
            preview: 'Before:\\n{"private":true}\\n\\nAfter:\\n{"private":true,"scripts":{"safe":"node safe.mjs"}}',
            previewTruncated: false,
            reason: "Add a reviewed launcher command.",
            requestedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
          },
        ],
        history: [],
        error: null,
      }),
    });
  });

  await page.goto("/");
  await page
    .locator('[data-component="HomeProfessorMariChat.MariPanel"]')
    .getByRole("button", { name: "Ask Professor Mari" })
    .click();

  const window = page.locator('[data-component="HomeProfessorMariChat.Window"]');
  await expect(window.getByText("Install this dependency?")).toBeVisible();
  await expect(window.getByText("nanoid@5.1.11")).toBeVisible();
  await expect(window.getByRole("button", { name: "Install" })).toBeVisible();
  await expect(window.getByRole("button", { name: "Not now" })).toBeVisible();
  await expect(window.getByText("Apply sensitive file change?")).toBeVisible();
  await expect(window.getByText("package.json", { exact: true })).toBeVisible();
  await expect(window.getByRole("button", { name: "Apply change" })).toBeVisible();
  await expect(window.getByRole("button", { name: "Discard" })).toBeVisible();
  await expect.poll(() => window.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test("Lorebook Save keeps Overview stable while the updated detail cache settles", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop editor regression");

  const name = `Lorebook save stability ${Date.now()}`;
  const createResponse = await page.request.post("/api/lorebooks", {
    data: {
      name,
      description: "Temporary browser regression lorebook.",
      category: "world",
      isGlobal: true,
      enabled: true,
    },
  });
  expect(createResponse.ok()).toBeTruthy();
  const lorebook = (await createResponse.json()) as { id: string };

  let patchSaved = false;
  await page.route(`**/api/lorebooks/${lorebook.id}`, async (route) => {
    const method = route.request().method();
    if (method === "PATCH") {
      const response = await route.fetch();
      patchSaved = response.ok();
      await route.fulfill({ response });
      return;
    }
    if (method === "GET" && patchSaved) {
      // Expose the old cache race: before the fix, Save marked the form clean
      // and reloaded its stale pre-save detail while this refetch was pending.
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    await route.continue();
  });

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-lorebooks"]').click();
    await page.getByText(name, { exact: true }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();

    await page.getByRole("checkbox", { name: "Disable global lorebook" }).evaluate((element) => {
      (element as HTMLInputElement).click();
    });
    const disabledGlobalSwitch = page.getByRole("checkbox", { name: "Enable global lorebook" });
    await expect(disabledGlobalSwitch).not.toBeChecked();

    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Lorebook saved")).toBeVisible();
    await page.waitForTimeout(900);
    await expect(disabledGlobalSwitch).toBeVisible();
    await expect(disabledGlobalSwitch).not.toBeChecked();

    const savedResponse = await page.request.get(`/api/lorebooks/${lorebook.id}`);
    expect(savedResponse.ok()).toBeTruthy();
    expect(((await savedResponse.json()) as { isGlobal: boolean }).isGlobal).toBe(false);
  } finally {
    if (!page.isClosed()) {
      await page.unroute(`**/api/lorebooks/${lorebook.id}`);
      await page.request.delete(`/api/lorebooks/${lorebook.id}`);
    }
  }
});

test("Lorebook entry type descriptions inherit editor chrome text", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop entry-type popover regression.");

  const name = `Lorebook entry chrome ${Date.now()}`;
  const createResponse = await page.request.post("/api/lorebooks", {
    data: { name, description: "Temporary entry-type color regression lorebook.", category: "world", enabled: true },
  });
  expect(createResponse.ok()).toBeTruthy();
  const lorebook = (await createResponse.json()) as { id: string };
  const entryResponse = await page.request.post(`/api/lorebooks/${lorebook.id}/entries`, {
    data: { name: "Entry type color", content: "Regression content", keys: ["regression"] },
  });
  expect(entryResponse.ok()).toBeTruthy();
  const entry = (await entryResponse.json()) as { id: string };

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-lorebooks"]').click();
    await page.getByText(name, { exact: true }).click();
    await page.getByRole("button", { name: /^Entries/ }).click();
    const row = page.locator(`[data-lorebook-entry-row-id="${entry.id}"]`);
    await row.getByRole("button", { name: /Entry type: Normal\. Choose entry type\./ }).click();
    const menu = page.getByRole("menu", { name: "Choose entry type" });
    await expect(menu).toBeVisible();
    const editorMutedColor = await readCssVariableColor(page, "--marinara-editor-muted");
    for (const description of [
      "Triggers when primary keys match the scanned text.",
      "Injects every time this lorebook is active.",
      "Primary keys must match with the secondary-key logic.",
    ]) {
      await expect(menu.getByText(description, { exact: true })).toHaveCSS("color", editorMutedColor);
    }
  } finally {
    await page.request.delete(`/api/lorebooks/${lorebook.id}`);
  }
});

test("selected Lorebook entries mirror safe edits and choose a move destination on demand", async ({ page }) => {
  const name = `Lorebook batch edit ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const targetName = `${name} destination`;
  const createResponse = await page.request.post("/api/lorebooks", {
    data: { name, description: "Temporary batch-edit regression lorebook.", category: "world", enabled: true },
  });
  expect(createResponse.ok()).toBeTruthy();
  const lorebook = (await createResponse.json()) as { id: string };
  const targetResponse = await page.request.post("/api/lorebooks", {
    data: { name: targetName, description: "Temporary move target.", category: "world", enabled: true },
  });
  expect(targetResponse.ok()).toBeTruthy();
  const targetLorebook = (await targetResponse.json()) as { id: string };

  try {
    const createdEntries: Array<{ id: string; name: string }> = [];
    for (const [index, entryName] of ["Batch Entry One", "Batch Entry Two"].entries()) {
      const entryResponse = await page.request.post(`/api/lorebooks/${lorebook.id}/entries`, {
        data: {
          name: entryName,
          description: `${entryName} description`,
          content: `${entryName} content`,
          keys: [`primary-${index + 1}`],
          secondaryKeys: [`secondary-${index + 1}`],
          preventRecursion: true,
          useRegex: false,
        },
      });
      expect(entryResponse.ok()).toBeTruthy();
      createdEntries.push((await entryResponse.json()) as { id: string; name: string });
    }

    await page.goto("/");
    await page.locator('[data-tour="panel-lorebooks"]').click();
    await page.getByText(name, { exact: true }).click();
    await page.getByRole("button", { name: /^Entries/ }).click();
    await expect(
      page.getByText("Use the Select button above to enter batch editing mode and edit multiple entries at once.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByTitle("Select entries for batch editing, copying, moving, or deletion").click();
    await page.getByRole("button", { name: "Select all", exact: true }).click();
    await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "You are in batch editing mode. Change applied to one entry will apply to all the selected ones.",
    );
    await expect(page.getByLabel("Setting to apply to selected entries")).toHaveCount(0);
    await expect(page.getByLabel("Value to apply to selected entries")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Destination lorebook", { exact: true })).toHaveCount(0);

    const firstEntryRow = page.locator(`[data-lorebook-entry-row-id="${createdEntries[0]!.id}"]`);
    await firstEntryRow.getByRole("button", { name: "Enable regex key matching", exact: true }).click();
    await expect
      .poll(async () => {
        const entriesResponse = await page.request.get(`/api/lorebooks/${lorebook.id}/entries`);
        const entries = (await entriesResponse.json()) as Array<{ useRegex: boolean }>;
        return entries.map((entry) => entry.useRegex);
      })
      .toEqual([true, true]);

    await firstEntryRow.getByRole("button", { name: "Expand entry", exact: true }).click();
    await firstEntryRow
      .getByText("Role", { exact: true })
      .locator("..")
      .getByRole("combobox")
      .selectOption("assistant");
    const descriptionField = firstEntryRow.locator("textarea").first();
    await descriptionField.fill("Only the first description changes.");
    await descriptionField.blur();
    await expect
      .poll(async () => {
        const entriesResponse = await page.request.get(`/api/lorebooks/${lorebook.id}/entries`);
        const entries = (await entriesResponse.json()) as Array<{
          content: string;
          description: string;
          keys: string[];
          role: string;
          secondaryKeys: string[];
        }>;
        return entries.map((entry) => ({
          content: entry.content,
          description: entry.description,
          keys: entry.keys,
          role: entry.role,
          secondaryKeys: entry.secondaryKeys,
        }));
      })
      .toEqual([
        {
          content: "Batch Entry One content",
          description: "Only the first description changes.",
          keys: ["primary-1"],
          role: "assistant",
          secondaryKeys: ["secondary-1"],
        },
        {
          content: "Batch Entry Two content",
          description: "Batch Entry Two description",
          keys: ["primary-2"],
          role: "assistant",
          secondaryKeys: ["secondary-2"],
        },
      ]);

    const batchToolbar = page.getByRole("status").locator("..");
    const moveButton = batchToolbar.getByRole("button", { name: "Move", exact: true });
    const deleteButton = batchToolbar.getByRole("button", { name: "Delete", exact: true });
    await expect(moveButton).toHaveClass(/mari-editor-action/);
    await expect(deleteButton).toHaveClass(/mari-editor-action/);
    await expect(moveButton).not.toHaveClass(/destructive/);
    await moveButton.click();
    const moveDialog = page.getByRole("dialog", { name: "Move Lorebook Entries", exact: true });
    await expect(moveDialog).toBeVisible();
    await moveDialog.getByLabel("Destination lorebook", { exact: true }).selectOption(targetLorebook.id);
    await moveDialog.getByRole("button", { name: "Move entries", exact: true }).click();
    await expect(moveDialog).toBeHidden();
    await expect
      .poll(async () => {
        const [sourceEntriesResponse, targetEntriesResponse] = await Promise.all([
          page.request.get(`/api/lorebooks/${lorebook.id}/entries`),
          page.request.get(`/api/lorebooks/${targetLorebook.id}/entries`),
        ]);
        return {
          source: ((await sourceEntriesResponse.json()) as unknown[]).length,
          target: ((await targetEntriesResponse.json()) as unknown[]).length,
        };
      })
      .toEqual({ source: 0, target: 2 });
  } finally {
    await page.request.delete(`/api/lorebooks/${lorebook.id}`).catch(() => undefined);
    await page.request.delete(`/api/lorebooks/${targetLorebook.id}`).catch(() => undefined);
  }
});

test("Lorebook context filter chips expose Noodle and keep complete borders", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop Lorebook filter geometry is covered on desktop.");

  const suffix = Date.now();
  const characterName = `Filter chip character ${suffix}`;
  const characterTag = `Filter tag ${suffix}`;
  const lorebookName = `Lorebook filter chip geometry ${suffix}`;
  const entryName = `Filter chip entry ${suffix}`;
  const characterResponse = await page.request.post("/api/characters", {
    data: { data: { name: characterName, tags: [characterTag] } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const lorebookResponse = await page.request.post("/api/lorebooks", {
    data: {
      name: lorebookName,
      description: "Temporary filter chip geometry fixture.",
      category: "world",
      enabled: true,
    },
  });
  expect(lorebookResponse.ok()).toBeTruthy();
  const lorebook = (await lorebookResponse.json()) as { id: string };
  const entryResponse = await page.request.post(`/api/lorebooks/${lorebook.id}/entries`, {
    data: {
      name: entryName,
      content: "Filter chip geometry fixture content.",
      characterFilterMode: "include",
      characterFilterIds: [character.id],
      characterTagFilterMode: "include",
      characterTagFilters: [characterTag],
      generationTriggerFilterMode: "include",
      generationTriggerFilters: ["conversation"],
      additionalMatchingSources: ["character_name"],
    },
  });
  expect(entryResponse.ok()).toBeTruthy();
  const entry = (await entryResponse.json()) as { id: string };

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-lorebooks"]').click();
    await page.getByText(lorebookName, { exact: true }).click();
    await page.getByRole("button", { name: /^Entries/ }).click();
    await page.getByRole("button", { name: "Expand entry" }).click();
    await page.getByText("Context filters & matching sources", { exact: true }).click();

    const filterArea = page.locator("details").filter({ hasText: "Context filters & matching sources" });
    const chips = filterArea.locator("button.mari-editor-chip");
    await expect(chips.first()).toBeVisible();
    expect(await chips.count()).toBeGreaterThan(8);
    await expect(filterArea.locator("button.mari-editor-chip--accent")).toHaveCount(4);

    const noodleChip = filterArea.getByRole("button", { name: "Noodle", exact: true });
    await expect(noodleChip).toBeVisible();
    await noodleChip.click();
    await expect(noodleChip).toHaveClass(/mari-editor-chip--accent/u);
    await expect
      .poll(async () => {
        const entriesResponse = await page.request.get(`/api/lorebooks/${lorebook.id}/entries`);
        const entries = (await entriesResponse.json()) as Array<{ id: string; generationTriggerFilters: string[] }>;
        return entries.find((candidate) => candidate.id === entry.id)?.generationTriggerFilters ?? [];
      })
      .toContain("noodle");

    const invalidBorders = await chips.evaluateAll((elements) =>
      elements
        .map((element) => {
          const style = getComputedStyle(element);
          return {
            label: element.textContent?.trim() ?? "",
            widths: [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth],
            styles: [style.borderTopStyle, style.borderRightStyle, style.borderBottomStyle, style.borderLeftStyle],
            shadow: style.boxShadow,
          };
        })
        .filter(
          (chip) =>
            chip.widths.some((width) => width !== "1px") ||
            chip.styles.some((style) => style !== "solid") ||
            chip.shadow !== "none",
        ),
    );
    expect(invalidBorders).toEqual([]);
  } finally {
    await Promise.all([
      page.request.delete(`/api/lorebooks/${lorebook.id}`).catch(() => undefined),
      page.request.delete(`/api/characters/${character.id}`).catch(() => undefined),
    ]);
  }
});

test("Conversation autocompletes and renders standard emoji shortcodes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop Conversation autocomplete is covered on desktop.");

  const characterResponse = await page.request.post("/api/characters", {
    data: { data: { name: `Emoji Character ${Date.now()}` } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Standard emoji autocomplete", mode: "conversation", characterIds: [character.id] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", characterId: character.id, content: "Model sent :CRYING:" },
    });
    expect(messageResponse.ok()).toBeTruthy();
    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");

    await expect(page.getByText("Model sent 😢", { exact: true })).toBeVisible();
    const input = page.locator('textarea[placeholder*="Message"]').last();
    await input.fill(":CRY");
    const cryingSuggestion = page.getByRole("button", { name: /:crying:.*Standard/i });
    await expect(cryingSuggestion).toBeVisible();
    await cryingSuggestion.click();
    await expect(input).toHaveValue("😢 ");
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
    await page.request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("streamed profile and full-backup ZIPs round-trip through import preview", async ({ request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Backup archive round-trip is covered once on desktop.");
  test.setTimeout(90_000);

  const characterResponse = await request.post("/api/characters", {
    data: {
      data: {
        name: `Backup archive smoke ${Date.now()}`,
        description: "A small fixture that must survive the sharded profile archive.",
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };

  try {
    const automaticSettingsResponse = await request.get("/api/backup/automatic");
    expect(automaticSettingsResponse.ok()).toBeTruthy();
    const automaticSettings = (await automaticSettingsResponse.json()) as {
      enabled: boolean;
      retentionCount: number;
    };
    expect(automaticSettings.enabled).toBe(false);
    expect(automaticSettings.retentionCount).toBeGreaterThanOrEqual(1);

    const enableAutomaticResponse = await request.put("/api/backup/automatic", {
      data: { enabled: true, frequency: "daily", retentionCount: 3 },
    });
    expect(enableAutomaticResponse.ok()).toBeTruthy();
    expect(((await enableAutomaticResponse.json()) as { retentionCount: number }).retentionCount).toBe(3);
    await expect
      .poll(
        async () => {
          const statusResponse = await request.get("/api/backup/automatic");
          if (!statusResponse.ok()) return false;
          const status = (await statusResponse.json()) as {
            backupExists: boolean;
            lastBackupAt: string | null;
            lastError: string | null;
          };
          return status.backupExists && Boolean(status.lastBackupAt) && status.lastError === null;
        },
        { timeout: 30_000 },
      )
      .toBe(true);

    const archiveRequests = [
      {
        name: "marinara-profile.zip",
        load: () => request.get("/api/backup/export-profile?format=zip", { timeout: 60_000 }),
      },
      {
        name: "marinara-backup.zip",
        load: () => request.post("/api/backup/download", { timeout: 60_000 }),
      },
    ];

    for (const archiveRequest of archiveRequests) {
      const archiveResponse = await archiveRequest.load();
      expect(archiveResponse.ok(), `${archiveRequest.name} should download`).toBeTruthy();
      expect(archiveResponse.headers()["content-type"]).toContain("application/zip");
      const archive = await archiveResponse.body();
      expect(archive.subarray(0, 2).toString("ascii")).toBe("PK");
      expect(Number(archiveResponse.headers()["content-length"])).toBe(archive.length);

      const previewResponse = await request.post("/api/backup/import-profile?preview=true", {
        multipart: {
          file: {
            name: archiveRequest.name,
            mimeType: "application/zip",
            buffer: archive,
          },
        },
        timeout: 60_000,
      });
      expect(previewResponse.ok(), `${archiveRequest.name} should preview-import`).toBeTruthy();
      const preview = (await previewResponse.json()) as {
        success: boolean;
        preview: boolean;
        imported: { characters: number };
      };
      expect(preview.success).toBe(true);
      expect(preview.preview).toBe(true);
      expect(preview.imported.characters).toBeGreaterThanOrEqual(1);
    }
  } finally {
    await request
      .put("/api/backup/automatic", { data: { enabled: false, frequency: "daily", retentionCount: 1 } })
      .catch(() => undefined);
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("home page stays fitted while FAQ behavior matches the viewport", async ({ page }, testInfo) => {
  const errors = collectUnexpectedErrors(page);
  const mobile = testInfo.project.name.includes("mobile");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const home = page.locator('[data-component="ChatArea.EmptyState"]');
  const content = page.locator('[data-component="ChatArea.HomeContent"]');
  await expect(home).toBeVisible();
  await expect(content).toBeVisible();

  await expectHomeContentFits(page);
  await expect(home).toHaveCSS("overflow-y", "hidden");
  const defaultScale = await content.evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    return transform === "none" ? 1 : new DOMMatrix(transform).a;
  });
  expect(defaultScale).toBeGreaterThanOrEqual(0.9);

  const inlineFaq = page.locator('[data-component="HomeFaq.Compact"]');
  const mobileFaqLauncher = page.locator('[data-component="HomeFaq.MobileLauncher"]');

  if (mobile) {
    await expect(inlineFaq).toBeHidden();
    await expect(mobileFaqLauncher).toBeVisible();
    await expect(mobileFaqLauncher.locator(".lucide-chevron-right")).toHaveCount(0);

    const recentChats = page.locator('[data-component="RecentChats"]');
    await expect(recentChats.locator(".overflow-x-auto")).toHaveCount(0);
    expect(await recentChats.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
    const recentChatButtons = recentChats.getByRole("button");
    const recentChatButtonCount = await recentChatButtons.count();
    if (recentChatButtonCount > 1) {
      const rowPositions = await recentChatButtons.evaluateAll((buttons) =>
        buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
      );
      expect(new Set(rowPositions).size).toBe(1);
    }
    const mariPanel = page.locator('[data-component="HomeProfessorMariChat.MariPanel"]');
    const mariSprite = page.locator('[data-component="HomeProfessorMariChat.Scene"] [data-part="sprite"]');
    const mobileGeometry = await Promise.all([
      recentChats.boundingBox(),
      mariPanel.boundingBox(),
      mariSprite.boundingBox(),
    ]);
    const [recentRect, panelRect, spriteRect] = mobileGeometry;
    expect(recentRect).not.toBeNull();
    expect(panelRect).not.toBeNull();
    expect(spriteRect).not.toBeNull();
    expect(spriteRect!.y).toBeLessThan(panelRect!.y);
    expect(spriteRect!.y).toBeGreaterThanOrEqual(recentRect!.y + recentRect!.height);

    await mobileFaqLauncher.getByRole("button", { name: "Open Professor Mari's FAQ" }).click();
    const faqDialog = page.getByRole("dialog", { name: "Professor Mari's FAQ" });
    await expect(faqDialog).toBeVisible();
    await expect(faqDialog.getByRole("searchbox", { name: "Search FAQ" })).toBeVisible();
    await expect(faqDialog.getByText("Start here before you go hunting through Discord logs.")).toHaveCount(0);
    await expect(faqDialog.getByText("Before You Post A Bug")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(faqDialog).toBeHidden();
  } else {
    await expect(mobileFaqLauncher).toBeHidden();
    await expect(inlineFaq).toBeVisible();
    const desktopFaqHeader = inlineFaq.locator('[data-component="HomeFaq.DesktopHeader"]');
    await expect(desktopFaqHeader).toBeVisible();
    expect(await desktopFaqHeader.evaluate((element) => element.tagName)).toBe("DIV");
    await expect(inlineFaq.locator('[data-component="HomeFaq.CompactList"]')).toBeVisible();

    const faqPanel = page.locator('[data-component="HomeProfessorMariChat.FaqPanel"]');
    const [faqPanelRect, inlineFaqRect] = await Promise.all([faqPanel.boundingBox(), inlineFaq.boundingBox()]);
    expect(faqPanelRect).not.toBeNull();
    expect(inlineFaqRect).not.toBeNull();
    expect(
      Math.abs(faqPanelRect!.y + faqPanelRect!.height - (inlineFaqRect!.y + inlineFaqRect!.height)),
    ).toBeLessThanOrEqual(12);

    const mariWelcome = page.locator('[data-component="HomeProfessorMariChat.Welcome"]');
    await expect(mariWelcome).toBeVisible();
    const mariWelcomeFits = await mariWelcome.evaluate((element) => element.scrollHeight <= element.clientHeight + 1);
    expect(mariWelcomeFits).toBe(true);
  }

  await page.setViewportSize({ width: mobile ? 390 : 1024, height: mobile ? 650 : 700 });
  await expectHomeContentFits(page);
  await expect(home).toHaveCSS("overflow-y", "hidden");

  expect(errors).toEqual([]);
});

test("Noodle interface icons consistently use Noodle blue", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The full Noodle settings surface is covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  await page.goto("/");
  await page.locator('[data-tour="noodle-tab"]').click();

  const noodle = page.locator('[data-component="NoodleView"]');
  await expect(noodle).toBeVisible();

  const expectBlueIcons = async (selector: string) => {
    const iconColors = await page
      .locator(selector)
      .locator("svg:visible")
      .evaluateAll((icons) => Array.from(new Set(icons.map((icon) => getComputedStyle(icon).color))));
    expect(iconColors.length).toBeGreaterThan(0);
    expect(iconColors).toEqual(["rgb(126, 167, 255)"]);
  };

  await expectBlueIcons('[data-component="NoodleView"]');
  await noodle.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(noodle.getByRole("button", { name: "Reset Noodle Timeline" })).toBeVisible();
  await expect(noodle.getByRole("button", { name: "Uninvite everybody" })).toHaveCSS("color", "rgb(126, 167, 255)");
  const scheduleCard = noodle.locator('[data-component="NoodleView.RefreshSchedule"]');
  await expect(scheduleCard).toBeVisible();
  await expect(scheduleCard.getByText("Automatic schedule")).toBeVisible();
  await expectBlueIcons('[data-component="NoodleView"]');

  const firstBootstrapResponse = await page.request.get("/api/noodle");
  expect(firstBootstrapResponse.ok()).toBe(true);
  const firstBootstrap = (await firstBootstrapResponse.json()) as {
    settings: { refreshesPerDay: number };
    scheduler: { scheduledTimes: string[]; completedTimes: string[] };
  };
  expect(firstBootstrap.scheduler.scheduledTimes).toHaveLength(firstBootstrap.settings.refreshesPerDay);
  const secondBootstrap = (await (await page.request.get("/api/noodle")).json()) as {
    scheduler: { scheduledTimes: string[] };
  };
  expect(secondBootstrap.scheduler.scheduledTimes).toEqual(firstBootstrap.scheduler.scheduledTimes);

  await expect(scheduleCard.locator("[data-noodle-schedule-slot]")).toHaveCount(
    firstBootstrap.scheduler.scheduledTimes.length,
  );
  const pendingRefreshCount = firstBootstrap.scheduler.scheduledTimes.filter(
    (scheduledTime) => !firstBootstrap.scheduler.completedTimes.includes(scheduledTime),
  ).length;
  const rescheduleButtons = scheduleCard.getByRole("button", { name: /^Reschedule refresh / });
  await expect(rescheduleButtons).toHaveCount(pendingRefreshCount);
  if (pendingRefreshCount > 0) {
    await rescheduleButtons.first().click();
    await expect(scheduleCard.getByLabel(/^New time for refresh /)).toBeVisible();
    await expect(scheduleCard.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
    await scheduleCard.getByRole("button", { name: "Cancel reschedule" }).click();
    await expect(scheduleCard.getByLabel(/^New time for refresh /)).toHaveCount(0);
  }

  await noodle.getByRole("button", { name: "Reset Noodle Timeline" }).click();
  const resetDialog = page.getByRole("dialog", { name: "Reset Noodle Timeline" });
  await expect(resetDialog).toBeVisible();
  await expectBlueIcons('[role="dialog"][aria-label="Reset Noodle Timeline"]');
  await resetDialog.getByRole("button", { name: "Cancel" }).click();

  expect(errors).toEqual([]);
});

test("NoodleR profile controls and mobile navigation use its pink accent", async ({ page }, testInfo) => {
  const initialResponse = await page.request.get("/api/noodle");
  expect(initialResponse.ok()).toBe(true);
  const initial = (await initialResponse.json()) as { settings: { enableNoodler: boolean } };
  const personaResponse = await page.request.post("/api/characters/personas", {
    data: { name: `NoodleR color viewer ${Date.now()}` },
  });
  expect(personaResponse.ok()).toBe(true);
  const persona = (await personaResponse.json()) as { id: string };

  try {
    const enableResponse = await page.request.put("/api/noodle/settings", { data: { enableNoodler: true } });
    expect(enableResponse.ok()).toBe(true);

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();
    await page.evaluate(async (personaId) => {
      const { useUIStore } = (await import("/src/stores/ui.store.ts")) as {
        useUIStore: {
          getState: () => {
            setNoodleSelectedPersonaId: (id: string | null) => void;
            setNoodleNavigation: (destination: { mode: "noodler"; view: "hub" }) => void;
          };
        };
      };
      const ui = useUIStore.getState();
      ui.setNoodleSelectedPersonaId(personaId);
      ui.setNoodleNavigation({ mode: "noodler", view: "hub" });
    }, persona.id);

    const noodle = page.locator('[data-component="NoodleView"]');
    await expect
      .poll(() => noodle.evaluate((element) => getComputedStyle(element).getPropertyValue("--noodle-accent").trim()))
      .toBe("#FF7EC1");
    const emptyMessage = noodle.getByText("No stage profiles are visible to this persona.", { exact: true });
    await expect(emptyMessage).toBeVisible();
    await expect(emptyMessage.locator("..").locator("svg")).toHaveCSS("color", "rgb(255, 126, 193)");

    const bottomNav = noodle.locator('[data-component="NoodleView.MobileBottomNav"]');
    if (testInfo.project.name.includes("mobile")) {
      await expect(bottomNav).toBeVisible();
      const colors = await bottomNav
        .locator("svg:visible")
        .evaluateAll((icons) => Array.from(new Set(icons.map((icon) => getComputedStyle(icon).color))));
      expect(colors.length).toBeGreaterThan(0);
      expect(colors).toEqual(["rgb(255, 126, 193)"]);
    } else {
      await expect(bottomNav).toBeHidden();
      const search = noodle.getByPlaceholder("Search posts or @creators").locator("..").locator("svg").first();
      await expect(search).toHaveCSS("color", "rgb(255, 126, 193)");
      const bulkCreate = noodle.getByRole("button", { name: "Bulk-create creators", exact: true });
      await expect(bulkCreate.locator("svg")).toHaveCSS("color", "rgb(255, 126, 193)");
      await bulkCreate.click();
      const bulkDialog = page.getByRole("dialog", { name: "Bulk-create creators" });
      const bulkSearch = bulkDialog.locator('input[placeholder="Search accounts"]').locator("..").locator("svg").first();
      await expect(bulkSearch).toHaveCSS("color", "rgb(255, 126, 193)");
    }
  } finally {
    await page.request.put("/api/noodle/settings", { data: { enableNoodler: initial.settings.enableNoodler } });
    await page.request.delete(`/api/characters/personas/${persona.id}`);
  }
});

test("Noodle settings edit and restore the timeline base prompt", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The complete prompt editing flow is covered on desktop.");

  const promptKey = "noodle.timelineBase";
  const initialDetailResponse = await page.request.get(`/api/prompt-overrides/${promptKey}`);
  expect(initialDetailResponse.ok()).toBe(true);
  const initialDetail = (await initialDetailResponse.json()) as {
    override: { template: string; enabled: boolean } | null;
  };
  const customPrompt = `Custom Noodle timeline base prompt ${Date.now()}.`;

  try {
    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();
    const noodle = page.locator('[data-component="NoodleView"]');
    await noodle.getByRole("button", { name: "Settings", exact: true }).click();

    const promptSetting = noodle.locator('[data-component="NoodleView.PromptSetting"]');
    await expect(promptSetting).toBeVisible();
    const promptRect = await promptSetting.boundingBox();
    const invitesRect = await noodle.getByRole("heading", { name: "Invites" }).boundingBox();
    expect(promptRect).not.toBeNull();
    expect(invitesRect).not.toBeNull();
    expect(promptRect!.y).toBeLessThan(invitesRect!.y);

    const editPromptButton = promptSetting.getByRole("button", { name: "Edit prompt" });
    await expect(editPromptButton).toHaveCSS("align-items", "center");
    await expect(editPromptButton).toHaveCSS("justify-content", "center");
    await expect(editPromptButton.locator("svg")).toBeVisible();
    await expect(editPromptButton.locator("svg")).toHaveCSS("color", "rgb(126, 167, 255)");
    await editPromptButton.click();
    const editor = page.locator('[data-component="ExpandedTextarea"]');
    await expect(editor.getByRole("heading", { name: "Edit Noodle Prompt" })).toBeVisible();
    const promptTextarea = editor.locator("textarea");
    await expect(promptTextarea).toHaveValue(
      /You write a fake social media timeline for Marinara Engine's in-app parody site called Noodle\./,
    );
    await promptTextarea.fill(customPrompt);
    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" &&
        new URL(response.url()).pathname === `/api/prompt-overrides/${promptKey}`,
    );
    await editor.getByRole("button", { name: "Save prompt" }).click();
    expect((await saveResponse).ok()).toBe(true);
    await expect(promptSetting).toContainText(customPrompt);
    await expect(promptSetting).toContainText("Custom");

    const restoreResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        new URL(response.url()).pathname === `/api/prompt-overrides/${promptKey}`,
    );
    await promptSetting.getByRole("button", { name: "Restore default" }).click();
    expect((await restoreResponse).ok()).toBe(true);
    await expect(promptSetting).toContainText("Default");

    await promptSetting.getByRole("button", { name: "Edit prompt" }).click();
    await expect(page.locator('[data-component="ExpandedTextarea"] textarea')).toHaveValue(
      /You write a fake social media timeline for Marinara Engine's in-app parody site called Noodle\./,
    );
  } finally {
    if (initialDetail.override) {
      await page.request.put(`/api/prompt-overrides/${promptKey}`, {
        data: initialDetail.override,
      });
    } else {
      await page.request.delete(`/api/prompt-overrides/${promptKey}`);
    }
  }
});

test("Noodle carryover mode labels fit inside their controls", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The compact three-column settings row is desktop-only.");

  await page.setViewportSize({ width: 1024, height: 700 });
  await page.goto("/");
  await page.locator('[data-tour="noodle-tab"]').click();
  const noodle = page.locator('[data-component="NoodleView"]');
  await noodle.getByRole("button", { name: "Settings", exact: true }).click();
  const carryoverSection = noodle.getByRole("heading", { name: "Carryover" }).locator("..");

  for (const name of ["Conversations", "Roleplays", "Games"]) {
    const checkbox = carryoverSection.getByRole("checkbox", { name, exact: true });
    const control = checkbox.locator("..");
    const text = control.getByText(name, { exact: true });
    await expect(control).toBeVisible();
    const [controlRect, textRect, checkboxRect] = await Promise.all([
      control.boundingBox(),
      text.boundingBox(),
      checkbox.boundingBox(),
    ]);
    expect(controlRect).not.toBeNull();
    expect(textRect).not.toBeNull();
    expect(checkboxRect).not.toBeNull();
    expect(textRect!.x).toBeGreaterThanOrEqual(controlRect!.x);
    expect(checkboxRect!.x - (textRect!.x + textRect!.width)).toBeGreaterThanOrEqual(6);
    expect(checkboxRect!.x + checkboxRect!.width).toBeLessThanOrEqual(controlRect!.x + controlRect!.width);
    expect(await text.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
});

test("Noodle settings persist through refetch and reload", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Noodle settings persistence is covered on desktop.");

  const initialResponse = await page.request.get("/api/noodle");
  expect(initialResponse.ok()).toBe(true);
  const initial = (await initialResponse.json()) as {
    settings: {
      enableImagePrompts: boolean;
      maxImagesPerRefresh: number;
      allowRandomUsers: boolean;
      carryoverMaxItems: number;
      refreshesPerDay: number;
    };
  };
  const nextImageLimit = initial.settings.maxImagesPerRefresh === 9 ? 8 : 9;
  const nextRandomUsers = !initial.settings.allowRandomUsers;
  const nextCarryItems = initial.settings.carryoverMaxItems === 10 ? 9 : 10;
  const nextRefreshesPerDay = initial.settings.refreshesPerDay === 3 ? 4 : 3;

  const enableImagesResponse = await page.request.put("/api/noodle/settings", {
    data: { enableImagePrompts: true },
  });
  expect(enableImagesResponse.ok()).toBe(true);
  const enabledSettings = (await enableImagesResponse.json()) as typeof initial.settings;
  expect(enabledSettings.enableImagePrompts).toBe(true);

  try {
    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();
    const noodle = page.locator('[data-component="NoodleView"]');
    await noodle.getByRole("button", { name: "Settings", exact: true }).click();

    const imageLimitInput = noodle
      .locator("label")
      .filter({ hasText: "Images/refresh" })
      .locator('input[type="number"]');
    await expect(imageLimitInput).toBeVisible();
    const imageSaveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/noodle/settings",
    );
    await imageLimitInput.fill(String(nextImageLimit));
    await imageLimitInput.blur();
    expect((await imageSaveResponse).ok()).toBe(true);
    await expect(imageLimitInput).toHaveValue(String(nextImageLimit));

    const randomUsersButton = noodle.getByRole("button", { name: /Random users/ });
    const randomUsersSaveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "PUT" && new URL(response.url()).pathname === "/api/noodle/settings",
    );
    await randomUsersButton.click();
    expect((await randomUsersSaveResponse).ok()).toBe(true);

    await expect
      .poll(async () => {
        const response = await page.request.get("/api/noodle");
        const bootstrap = (await response.json()) as typeof initial;
        return {
          maxImagesPerRefresh: bootstrap.settings.maxImagesPerRefresh,
          allowRandomUsers: bootstrap.settings.allowRandomUsers,
        };
      })
      .toEqual({ maxImagesPerRefresh: nextImageLimit, allowRandomUsers: nextRandomUsers });

    await page.reload();
    await page.locator('[data-tour="noodle-tab"]').click();
    const reloadedNoodle = page.locator('[data-component="NoodleView"]');
    await reloadedNoodle.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      reloadedNoodle.locator("label").filter({ hasText: "Images/refresh" }).locator('input[type="number"]'),
    ).toHaveValue(String(nextImageLimit));
    await expect(reloadedNoodle.getByRole("button", { name: /Random users/ })).toContainText(
      nextRandomUsers ? "Enabled" : "Ambient fake profiles",
    );

    const carryItemsInput = reloadedNoodle
      .locator("label")
      .filter({ hasText: "Carry items" })
      .locator('input[type="number"]');
    await carryItemsInput.fill(String(nextCarryItems));
    await reloadedNoodle.getByRole("button", { name: "Home", exact: true }).click();
    await reloadedNoodle.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      reloadedNoodle.locator("label").filter({ hasText: "Carry items" }).locator('input[type="number"]'),
    ).toHaveValue(String(nextCarryItems));
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/noodle");
        const bootstrap = (await response.json()) as typeof initial;
        return bootstrap.settings.carryoverMaxItems;
      })
      .toBe(nextCarryItems);

    const refreshesPerDayInput = reloadedNoodle
      .locator("label")
      .filter({ hasText: "Refreshes/day" })
      .locator('input[type="number"]');
    await refreshesPerDayInput.fill(String(nextRefreshesPerDay));
    await reloadedNoodle.getByRole("button", { name: /Notifications/ }).click();
    await reloadedNoodle.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(
      reloadedNoodle.locator("label").filter({ hasText: "Refreshes/day" }).locator('input[type="number"]'),
    ).toHaveValue(String(nextRefreshesPerDay));
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/noodle");
        const bootstrap = (await response.json()) as typeof initial;
        return bootstrap.settings.refreshesPerDay;
      })
      .toBe(nextRefreshesPerDay);
  } finally {
    await page.request.put("/api/noodle/settings", {
      data: {
        enableImagePrompts: initial.settings.enableImagePrompts,
        maxImagesPerRefresh: initial.settings.maxImagesPerRefresh,
        allowRandomUsers: initial.settings.allowRandomUsers,
        carryoverMaxItems: initial.settings.carryoverMaxItems,
        refreshesPerDay: initial.settings.refreshesPerDay,
      },
    });
  }
});

test("Noodle restores the selected persona and preserves per-persona post authorship", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Noodle persona persistence is covered on desktop.");

  const createdPersonaIds: string[] = [];
  const createdPostIds: string[] = [];
  try {
    for (const name of ["Noodle Persona One", "Noodle Persona Two"]) {
      const response = await page.request.post("/api/characters/personas", {
        data: { name, description: "Temporary Noodle account persistence regression persona." },
      });
      expect(response.ok()).toBe(true);
      createdPersonaIds.push(((await response.json()) as { id: string }).id);
    }
    const selectedPersonaId = createdPersonaIds[1]!;
    expect((await page.request.get("/api/noodle")).ok()).toBe(true);
    const authoredPosts = [];
    for (const [index, personaId] of createdPersonaIds.entries()) {
      const response = await page.request.post("/api/noodle/posts", {
        data: {
          authorKind: "persona",
          authorEntityId: personaId,
          content: `Authorship regression post ${index + 1}`,
        },
      });
      expect(response.ok()).toBe(true);
      const post = (await response.json()) as {
        id: string;
        authorAccountId: string;
        authorSnapshot: { kind: string; entityId: string; displayName: string; handle: string } | null;
      };
      createdPostIds.push(post.id);
      authoredPosts.push(post);
      expect(post.authorSnapshot).toMatchObject({
        kind: "persona",
        entityId: personaId,
        displayName: `Noodle Persona ${index === 0 ? "One" : "Two"}`,
      });
    }
    expect(authoredPosts[0]?.authorAccountId).not.toBe(authoredPosts[1]?.authorAccountId);

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();
    const noodle = page.locator('[data-component="NoodleView"]');
    const accountSwitcher = noodle.locator('[data-component="NoodleView.AccountSwitcher"]');
    await accountSwitcher.click();
    await noodle.locator(`[data-noodle-persona-id="${selectedPersonaId}"]`).click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const raw = localStorage.getItem("marinara-engine-ui");
          if (!raw) return null;
          return (
            (JSON.parse(raw) as { state?: { noodleSelectedPersonaId?: string | null } }).state
              ?.noodleSelectedPersonaId ?? null
          );
        }),
      )
      .toBe(selectedPersonaId);

    await page.reload();
    await page.locator('[data-tour="noodle-tab"]').click();
    await expect(noodle).toBeVisible();
    await expect(accountSwitcher).toContainText("Noodle Persona Two");
    for (const [index, post] of authoredPosts.entries()) {
      const article = noodle.locator(`[data-noodle-post-id="${post.id}"]`);
      await expect(article).toContainText(`Noodle Persona ${index === 0 ? "One" : "Two"}`);
      await expect(article).toContainText(`@${post.authorSnapshot?.handle}`);
    }
  } finally {
    for (const postId of createdPostIds) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    for (const personaId of createdPersonaIds) {
      await page.request.delete(`/api/characters/personas/${personaId}`, { timeout: 5_000 }).catch(() => undefined);
    }
  }
});

test("Noodle posts tag invited characters with @handle mentions", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  const activePersonaResponse = await page.request.get("/api/characters/personas/active");
  const activePersona = activePersonaResponse.ok()
    ? ((await activePersonaResponse.json()) as { id?: string } | null)
    : null;
  let personaId = activePersona?.id ?? null;
  let createdPersonaId: string | null = null;
  let createdPostId: string | null = null;
  if (!personaId) {
    const personaResponse = await page.request.post("/api/characters/personas", {
      data: { name: "Noodle Mention Regression", description: "Temporary browser regression persona." },
    });
    expect(personaResponse.ok()).toBe(true);
    const createdPersona = (await personaResponse.json()) as { id: string };
    personaId = createdPersona.id;
    createdPersonaId = createdPersona.id;
    const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
    expect(activateResponse.ok()).toBe(true);
  }

  const initialBootstrapResponse = await page.request.get("/api/noodle");
  expect(initialBootstrapResponse.ok()).toBe(true);
  const initialBootstrap = (await initialBootstrapResponse.json()) as {
    accounts: Array<{ id: string; entityId: string; handle: string }>;
  };
  const professorMariAccount = initialBootstrap.accounts.find((account) => account.entityId === "__professor_mari__");
  expect(professorMariAccount).toBeTruthy();

  try {
    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const composer = noodle.locator('[data-component="NoodleView.InlineComposer"]');
    const textarea = composer.getByPlaceholder("What's simmering?");
    await textarea.fill("Dinner with @prof");

    const mentionList = composer.getByRole("listbox", { name: "Tag a character" });
    await expect(mentionList).toBeVisible();
    await mentionList.getByRole("option", { name: /Professor Mari.*@professor_mari/i }).click();
    await expect(textarea).toHaveValue("Dinner with @professor_mari ");
    await textarea.pressSequentially("tonight.");

    const postResponsePromise = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/noodle/posts",
    );
    await composer.getByRole("button", { name: "Post", exact: true }).click();
    const postResponse = await postResponsePromise;
    expect(postResponse.ok()).toBe(true);
    const post = (await postResponse.json()) as {
      id: string;
      metadata: { mentionedAccountIds?: string[] };
    };
    createdPostId = post.id;
    await expect(textarea).toHaveValue("");
    expect(post.metadata.mentionedAccountIds).toContain(professorMariAccount!.id);

    const postArticle = noodle.locator(`[data-noodle-post-id="${post.id}"]`);
    await expect(postArticle).toBeVisible();
    const mention = postArticle.getByRole("button", { name: "View @professor_mari profile" });
    await expect(mention).toBeVisible();

    const updatedBootstrap = (await (await page.request.get("/api/noodle")).json()) as {
      digests: Array<{ sourcePostId: string | null; accountIds: string[] }>;
    };
    const postDigest = updatedBootstrap.digests.find((digest) => digest.sourcePostId === post.id);
    expect(postDigest?.accountIds).toContain(professorMariAccount!.id);

    await mention.click();
    await expect(noodle.getByRole("heading", { name: "Professor Mari", exact: true })).toBeVisible();

    const replyResponse = await page.request.post(`/api/noodle/posts/${post.id}/interactions`, {
      data: {
        actorKind: "persona",
        actorEntityId: personaId,
        type: "reply",
        content: "Reply mention for @professor_mari.",
      },
    });
    expect(replyResponse.ok()).toBe(true);
    const reply = (await replyResponse.json()) as { id: string };

    await page.reload();
    await page.locator('[data-tour="noodle-tab"]').click();
    const desktopHome = noodle.getByRole("button", { name: "Home", exact: true });
    if (await desktopHome.isVisible()) {
      await desktopHome.click();
    } else {
      await noodle.getByRole("button", { name: "Noodle home" }).click();
    }
    const replyMention = page
      .locator(`[data-noodle-interaction-id="${reply.id}"]`)
      .getByRole("button", { name: "View @professor_mari profile" });
    await expect(replyMention).toBeVisible();
    await replyMention.click();
    await expect(noodle.getByRole("heading", { name: "Professor Mari", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    if (createdPostId) {
      await page.request.delete(`/api/noodle/posts/${createdPostId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle polls support character creation and voting on both sides", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  const activePersonaResponse = await page.request.get("/api/characters/personas/active");
  const activePersona = activePersonaResponse.ok()
    ? ((await activePersonaResponse.json()) as { id?: string } | null)
    : null;
  let personaId = activePersona?.id ?? null;
  let createdPersonaId: string | null = null;
  const createdPostIds: string[] = [];
  if (!personaId) {
    const personaResponse = await page.request.post("/api/characters/personas", {
      data: { name: "Noodle Poll Regression", description: "Temporary browser regression persona." },
    });
    expect(personaResponse.ok()).toBe(true);
    const createdPersona = (await personaResponse.json()) as { id: string };
    personaId = createdPersona.id;
    createdPersonaId = createdPersona.id;
    const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
    expect(activateResponse.ok()).toBe(true);
  }

  const initialBootstrapResponse = await page.request.get("/api/noodle");
  expect(initialBootstrapResponse.ok()).toBe(true);
  const initialBootstrap = (await initialBootstrapResponse.json()) as {
    accounts: Array<{ id: string; kind: string; entityId: string }>;
  };
  const professorMariAccount = initialBootstrap.accounts.find((account) => account.entityId === "__professor_mari__");
  const personaAccount = initialBootstrap.accounts.find(
    (account) => account.kind === "persona" && account.entityId === personaId,
  );
  expect(professorMariAccount).toBeTruthy();
  expect(personaAccount).toBeTruthy();

  const characterPollResponse = await page.request.post("/api/noodle/posts", {
    data: {
      authorKind: "character",
      authorEntityId: "__professor_mari__",
      content: "Help me choose the laboratory tea.",
      poll: { question: "Which tea should I brew?", options: ["Jasmine", "Earl Grey"] },
    },
  });
  expect(characterPollResponse.ok()).toBe(true);
  const characterPollPost = (await characterPollResponse.json()) as {
    id: string;
    metadata: { poll?: { options: Array<{ id: string; label: string }> } };
  };
  createdPostIds.push(characterPollPost.id);
  expect(characterPollPost.metadata.poll?.options).toHaveLength(2);

  try {
    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const characterPollArticle = noodle.locator(`[data-noodle-post-id="${characterPollPost.id}"]`);
    await expect(characterPollArticle.getByRole("region", { name: "Poll: Which tea should I brew?" })).toBeVisible();
    const jasmineOption = characterPollArticle.locator('[data-noodle-poll-option="option-1"]');
    const earlGreyOption = characterPollArticle.locator('[data-noodle-poll-option="option-2"]');

    await jasmineOption.click();
    await expect(jasmineOption).toHaveAttribute("aria-pressed", "true");
    await expect(characterPollArticle.getByText("1 vote · You voted")).toBeVisible();
    await earlGreyOption.click();
    await expect(earlGreyOption).toHaveAttribute("aria-pressed", "true");
    await expect(jasmineOption).toHaveAttribute("aria-pressed", "false");
    await expect(characterPollArticle.getByText("1 vote · You voted")).toBeVisible();

    const voteBootstrap = (await (await page.request.get("/api/noodle")).json()) as {
      interactions: Array<{
        postId: string;
        actorAccountId: string;
        type: string;
        content: string | null;
      }>;
    };
    const personaVotes = voteBootstrap.interactions.filter(
      (interaction) =>
        interaction.postId === characterPollPost.id &&
        interaction.actorAccountId === personaAccount!.id &&
        interaction.type === "vote",
    );
    expect(personaVotes).toHaveLength(1);
    expect(personaVotes[0]?.content).toBe("option-2");

    const composer = noodle.locator('[data-component="NoodleView.InlineComposer"]');
    await composer.getByTitle("Create poll").click();
    await page.getByPlaceholder("What question do you want to ask?").fill("Which experiment comes next?");
    await page.getByPlaceholder("Option 1").fill("Robotics");
    await page.getByPlaceholder("Option 2").fill("Alchemy");
    await page.getByRole("button", { name: "Add poll", exact: true }).click();
    await expect(composer.locator('[data-component="NoodleView.DraftPoll"]')).toBeVisible();

    const personaPollResponsePromise = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/noodle/posts",
    );
    await composer.getByRole("button", { name: "Post", exact: true }).click();
    const personaPollResponse = await personaPollResponsePromise;
    expect(personaPollResponse.ok()).toBe(true);
    const personaPollPost = (await personaPollResponse.json()) as {
      id: string;
      metadata: { poll?: { question: string; options: Array<{ id: string }> } };
    };
    createdPostIds.push(personaPollPost.id);
    expect(personaPollPost.metadata.poll?.question).toBe("Which experiment comes next?");

    const characterVoteResponse = await page.request.post(`/api/noodle/posts/${personaPollPost.id}/interactions`, {
      data: {
        actorKind: "character",
        actorEntityId: "__professor_mari__",
        type: "vote",
        content: personaPollPost.metadata.poll?.options[0]?.id,
      },
    });
    expect(characterVoteResponse.ok()).toBe(true);
    const characterVote = (await characterVoteResponse.json()) as {
      actorAccountId: string;
      type: string;
      content: string | null;
    };
    expect(characterVote.actorAccountId).toBe(professorMariAccount!.id);
    expect(characterVote.type).toBe("vote");
    expect(characterVote.content).toBe("option-1");
    expect(errors).toEqual([]);
  } finally {
    for (const postId of createdPostIds) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("liking one Noodle post leaves unrelated reaction controls visually stable", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Reaction stability is covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  const activePersonaResponse = await page.request.get("/api/characters/personas/active");
  const activePersona = activePersonaResponse.ok()
    ? ((await activePersonaResponse.json()) as { id?: string } | null)
    : null;
  let personaId = activePersona?.id ?? null;
  let createdPersonaId: string | null = null;
  const createdPostIds: string[] = [];
  if (!personaId) {
    const personaResponse = await page.request.post("/api/characters/personas", {
      data: { name: "Noodle Reaction Regression", description: "Temporary browser regression persona." },
    });
    expect(personaResponse.ok()).toBe(true);
    const createdPersona = (await personaResponse.json()) as { id: string };
    personaId = createdPersona.id;
    createdPersonaId = createdPersona.id;
    const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
    expect(activateResponse.ok()).toBe(true);
  }

  await page.request.get("/api/noodle");
  for (const label of ["First", "Second"]) {
    const response = await page.request.post("/api/noodle/posts", {
      data: {
        authorKind: "persona",
        authorEntityId: personaId,
        content: `${label} reaction stability post ${Date.now()}`,
      },
    });
    expect(response.ok()).toBe(true);
    createdPostIds.push(((await response.json()) as { id: string }).id);
  }

  const reactionRequestStarted = createDeferred();
  const releaseReaction = createDeferred();

  try {
    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const targetPost = noodle.locator(`[data-noodle-post-id="${createdPostIds[0]}"]`);
    const unrelatedPost = noodle.locator(`[data-noodle-post-id="${createdPostIds[1]}"]`);
    await expect(targetPost).toBeVisible();
    await expect(unrelatedPost).toBeVisible();

    const targetLike = targetPost.getByRole("button", { name: "Like post" });
    const unrelatedLike = unrelatedPost.getByRole("button", { name: "Like post" });
    await expect(targetLike.locator("svg")).toHaveAttribute("fill", "none");
    const unrelatedClass = await unrelatedLike.getAttribute("class");
    const unrelatedText = await unrelatedLike.textContent();
    await page.route("**/api/noodle/posts/*/interactions", async (route) => {
      if (route.request().method() === "POST") {
        reactionRequestStarted.resolve();
        await releaseReaction.promise;
      }
      await route.continue();
    });

    let bootstrapRequestsAfterLike = 0;
    let countBootstrapRequests = false;
    page.on("request", (request) => {
      if (countBootstrapRequests && request.method() === "GET" && new URL(request.url()).pathname === "/api/noodle") {
        bootstrapRequestsAfterLike += 1;
      }
    });

    countBootstrapRequests = true;
    await targetLike.click();
    await reactionRequestStarted.promise;
    await expect(targetLike).toBeDisabled();
    await expect(targetLike).toHaveAttribute("aria-busy", "true");
    await expect(unrelatedLike).toBeEnabled();
    await expect(unrelatedLike).toHaveAttribute("class", unrelatedClass ?? "");
    await expect(unrelatedLike).toHaveText(unrelatedText ?? "");

    releaseReaction.resolve();
    const targetUnlike = targetPost.getByRole("button", { name: "Unlike post" });
    await expect(targetUnlike).toBeEnabled();
    await expect(targetUnlike.locator("svg")).toHaveAttribute("fill", "currentColor");
    await expect(targetPost.locator('[data-noodle-reaction="like"]')).toContainText("1");
    await expect(unrelatedLike).toBeEnabled();
    await page.waitForTimeout(150);
    expect(bootstrapRequestsAfterLike).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    releaseReaction.resolve();
    for (const postId of createdPostIds) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle persona and character comments can be edited and deleted", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Comment ownership controls are covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  let personaId: string | null = null;
  let createdPersonaId: string | null = null;
  let postId: string | null = null;
  let controlPostId: string | null = null;

  try {
    const activePersonaResponse = await page.request.get("/api/characters/personas/active");
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    personaId = activePersona?.id ?? null;
    if (!personaId) {
      const personaResponse = await page.request.post("/api/characters/personas", {
        data: { name: "Noodle Comment Owner", description: "Temporary browser regression persona." },
      });
      expect(personaResponse.ok()).toBe(true);
      const createdPersona = (await personaResponse.json()) as { id: string };
      personaId = createdPersona.id;
      createdPersonaId = createdPersona.id;
      const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
      expect(activateResponse.ok()).toBe(true);
    }

    await page.request.get("/api/noodle");
    const postResponse = await page.request.post("/api/noodle/posts", {
      data: {
        authorKind: "character",
        authorEntityId: "__professor_mari__",
        content: `Comment ownership regression ${Date.now()}`,
      },
    });
    expect(postResponse.ok()).toBe(true);
    const post = (await postResponse.json()) as { id: string };
    postId = post.id;
    const controlPostResponse = await page.request.post("/api/noodle/posts", {
      data: {
        authorKind: "character",
        authorEntityId: "__professor_mari__",
        content: `Newer control post ${Date.now()}`,
      },
    });
    expect(controlPostResponse.ok()).toBe(true);
    const controlPost = (await controlPostResponse.json()) as { id: string };
    controlPostId = controlPost.id;

    const ownReplyResponse = await page.request.post(`/api/noodle/posts/${postId}/interactions`, {
      data: {
        actorKind: "persona",
        actorEntityId: personaId,
        type: "reply",
        content: "Original persona comment.",
      },
    });
    expect(ownReplyResponse.ok()).toBe(true);
    const ownReply = (await ownReplyResponse.json()) as { id: string };

    const childReplyResponse = await page.request.post(`/api/noodle/posts/${postId}/interactions`, {
      data: {
        actorKind: "character",
        actorEntityId: "__professor_mari__",
        type: "reply",
        content: "Character-owned child reply.",
        parentInteractionId: ownReply.id,
      },
    });
    expect(childReplyResponse.ok()).toBe(true);
    const childReply = (await childReplyResponse.json()) as { id: string };

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const activePost = noodle.locator(`[data-noodle-post-id="${postId}"]`);
    const newerControlPost = noodle.locator(`[data-noodle-post-id="${controlPostId}"]`);
    const ownComment = noodle.locator(`[data-noodle-interaction-id="${ownReply.id}"]`);
    const characterComment = noodle.locator(`[data-noodle-interaction-id="${childReply.id}"]`);
    await expect(newerControlPost).toBeVisible();
    await expect(ownComment).toBeVisible();
    await expect(characterComment).toBeVisible();
    expect(
      await activePost.evaluate((element, controlPostId) => {
        const control = document.querySelector(`[data-noodle-post-id="${controlPostId}"]`);
        return Boolean(control && element.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING);
      }, controlPostId),
    ).toBe(true);
    await expect(ownComment.getByRole("button", { name: "Edit comment" })).toBeVisible();
    await expect(ownComment.getByRole("button", { name: "Delete comment" })).toBeVisible();
    await expect(characterComment.getByRole("button", { name: "Edit comment" })).toBeVisible();
    await expect(characterComment.getByRole("button", { name: "Delete comment" })).toBeVisible();

    await characterComment.getByRole("button", { name: "Edit comment" }).click();
    const characterEditor = characterComment.locator('[data-component="NoodleView.CommentEditor"]');
    await characterEditor.getByRole("textbox", { name: "Edit comment" }).fill("Edited character reply.");
    await characterEditor.getByRole("button", { name: "Save" }).click();
    await expect(characterComment).toContainText("Edited character reply.");

    await characterComment.getByRole("button", { name: "Delete comment" }).click();
    const characterDeleteDialog = page.getByRole("dialog", { name: "Delete Noodle Comment" });
    await expect(characterDeleteDialog).toBeVisible();
    await characterDeleteDialog.getByRole("button", { name: "Delete comment" }).click();
    await expect(characterComment).toHaveCount(0);
    await expect(ownComment).toBeVisible();

    await ownComment.getByRole("button", { name: "Edit comment" }).click();
    const editor = ownComment.locator('[data-component="NoodleView.CommentEditor"]');
    await editor.getByRole("textbox", { name: "Edit comment" }).fill("Edited persona comment.");
    await editor.getByRole("button", { name: "Save" }).click();
    await expect(ownComment).toContainText("Edited persona comment.");

    await ownComment.getByRole("button", { name: "Delete comment" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete Noodle Comment" });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Delete comment" }).click();
    await expect(ownComment).toHaveCount(0);
    await expect(characterComment).toHaveCount(0);

    expect(errors).toEqual([]);
  } finally {
    if (postId) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (controlPostId) {
      await page.request.delete(`/api/noodle/posts/${controlPostId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle post and reply composers autocomplete character handles", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  let personaId: string | null = null;
  let createdPersonaId: string | null = null;
  let postId: string | null = null;

  try {
    const activePersonaResponse = await page.request.get("/api/characters/personas/active");
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    personaId = activePersona?.id ?? null;
    if (!personaId) {
      const personaResponse = await page.request.post("/api/characters/personas", {
        data: { name: "Noodle Mention Tester", description: "Temporary browser regression persona." },
      });
      expect(personaResponse.ok()).toBe(true);
      const createdPersona = (await personaResponse.json()) as { id: string };
      personaId = createdPersona.id;
      createdPersonaId = createdPersona.id;
      const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
      expect(activateResponse.ok()).toBe(true);
    }

    const bootstrapResponse = await page.request.get("/api/noodle");
    expect(bootstrapResponse.ok()).toBe(true);
    const bootstrap = (await bootstrapResponse.json()) as {
      accounts: Array<{ entityId: string; handle: string; kind: string; invited: boolean }>;
    };
    const mentionAccount = bootstrap.accounts.find(
      (account) => account.kind === "character" && account.invited && account.handle.length > 0,
    );
    expect(mentionAccount).toBeDefined();

    const postResponse = await page.request.post("/api/noodle/posts", {
      data: {
        authorKind: "character",
        authorEntityId: mentionAccount!.entityId,
        content: `Mention autocomplete regression ${Date.now()}`,
      },
    });
    expect(postResponse.ok()).toBe(true);
    const post = (await postResponse.json()) as { id: string };
    postId = post.id;
    const commentResponse = await page.request.post(`/api/noodle/posts/${post.id}/interactions`, {
      data: {
        actorKind: "character",
        actorEntityId: mentionAccount!.entityId,
        type: "reply",
        content: "A comment waiting for a tagged response.",
      },
    });
    expect(commentResponse.ok()).toBe(true);
    const comment = (await commentResponse.json()) as { id: string };

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const mentionPrefix = mentionAccount!.handle.slice(0, Math.min(2, mentionAccount!.handle.length));
    const inlineComposer = noodle.locator('[data-component="NoodleView.InlineComposer"]');
    const postTextarea = inlineComposer.getByPlaceholder("What's simmering?");
    await postTextarea.fill(`Hello @${mentionPrefix}`);

    const postMentionList = page.locator("#noodle-inline-mention-list");
    await expect(postMentionList).toBeVisible();
    const postMentionOption = postMentionList.getByRole("option").filter({ hasText: `@${mentionAccount!.handle}` });
    await expect(postMentionOption).toBeVisible();
    await postMentionOption.click();
    await expect(postTextarea).toHaveValue(`Hello @${mentionAccount!.handle} `);

    const activePost = noodle.locator(`[data-noodle-post-id="${postId}"]`);
    const targetComment = activePost.locator(`[data-noodle-interaction-id="${comment.id}"]`);
    await targetComment.getByTitle("Reply").click();
    const replyComposer = activePost.locator(
      `[data-component="NoodleView.ReplyComposer"][data-noodle-reply-parent-id="${comment.id}"]`,
    );
    const replyTextarea = replyComposer.getByPlaceholder("Leave a comment…");
    await replyTextarea.fill(`Replying @${mentionAccount!.handle}`);

    const replyMentionList = page.locator("#noodle-reply-mention-list");
    await expect(replyMentionList).toBeVisible();
    const replyMentionOption = replyMentionList.getByRole("option").filter({ hasText: `@${mentionAccount!.handle}` });
    await expect(replyMentionOption).toBeVisible();
    await replyTextarea.press("Tab");
    await expect(replyTextarea).toHaveValue(`Replying @${mentionAccount!.handle} `);

    expect(errors).toEqual([]);
  } finally {
    if (postId) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle desktop composers insert emojis at the active cursor", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop cursor placement is covered in the desktop shell.");

  const errors = collectUnexpectedErrors(page);
  let createdPersonaId: string | null = null;
  let postId: string | null = null;

  try {
    const activePersonaResponse = await page.request.get("/api/characters/personas/active");
    const activePersona = activePersonaResponse.ok()
      ? ((await activePersonaResponse.json()) as { id?: string } | null)
      : null;
    if (!activePersona?.id) {
      const personaResponse = await page.request.post("/api/characters/personas", {
        data: { name: "Noodle Cursor Tester", description: "Temporary browser regression persona." },
      });
      expect(personaResponse.ok()).toBe(true);
      const createdPersona = (await personaResponse.json()) as { id: string };
      createdPersonaId = createdPersona.id;
      const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
      expect(activateResponse.ok()).toBe(true);
    }

    const bootstrapResponse = await page.request.get("/api/noodle");
    expect(bootstrapResponse.ok()).toBe(true);
    const bootstrap = (await bootstrapResponse.json()) as {
      accounts: Array<{ entityId: string; kind: string; invited: boolean }>;
    };
    const characterAccount = bootstrap.accounts.find((account) => account.kind === "character" && account.invited);
    expect(characterAccount).toBeDefined();

    const postResponse = await page.request.post("/api/noodle/posts", {
      data: {
        authorKind: "character",
        authorEntityId: characterAccount!.entityId,
        content: `Emoji cursor regression ${Date.now()}`,
      },
    });
    expect(postResponse.ok()).toBe(true);
    const post = (await postResponse.json()) as { id: string };
    postId = post.id;

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const inlineComposer = noodle.locator('[data-component="NoodleView.InlineComposer"]');
    const postTextarea = inlineComposer.getByPlaceholder("What's simmering?");
    await postTextarea.fill("Alpha Omega");
    await postTextarea.evaluate((element: HTMLTextAreaElement) => {
      element.focus();
      element.setSelectionRange(6, 6);
    });
    await inlineComposer.getByTitle("Emoji, GIFs and stickers").click();
    await page.getByRole("textbox", { name: "Search emojis" }).fill("test tube");
    await page.getByRole("button", { name: /test tube/i }).click();
    await expect(postTextarea).toHaveValue("Alpha 🧪Omega");
    await expect.poll(() => postTextarea.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(8);
    await expect.poll(() => postTextarea.evaluate((element: HTMLTextAreaElement) => element.selectionEnd)).toBe(8);
    await inlineComposer.getByTitle("Emoji, GIFs and stickers").click();

    const activePost = noodle.locator(`[data-noodle-post-id="${post.id}"]`);
    await activePost.getByTitle("Reply").first().click();
    const replyComposer = activePost.locator('[data-component="NoodleView.ReplyComposer"]');
    const replyTextarea = replyComposer.getByPlaceholder("Leave a comment…");
    await replyTextarea.fill("Reply here");
    await replyTextarea.evaluate((element: HTMLTextAreaElement) => {
      element.focus();
      element.setSelectionRange(6, 10);
    });
    await replyComposer.getByTitle("Emoji, GIFs and stickers").click();
    await page.getByRole("textbox", { name: "Search emojis" }).fill("test tube");
    await page.getByRole("button", { name: /test tube/i }).click();
    await expect(replyTextarea).toHaveValue("Reply 🧪");
    await expect.poll(() => replyTextarea.evaluate((element: HTMLTextAreaElement) => element.selectionStart)).toBe(8);
    await expect.poll(() => replyTextarea.evaluate((element: HTMLTextAreaElement) => element.selectionEnd)).toBe(8);

    expect(errors).toEqual([]);
  } finally {
    if (postId) {
      await page.request.delete(`/api/noodle/posts/${postId}`, { timeout: 5_000 }).catch(() => undefined);
    }
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle reply notifications focus the actionable timeline reply", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Reply notification focus is covered on mobile.");

  const errors = collectUnexpectedErrors(page);
  const activePersonaResponse = await page.request.get("/api/characters/personas/active");
  const activePersona = activePersonaResponse.ok()
    ? ((await activePersonaResponse.json()) as { id?: string } | null)
    : null;
  let personaId = activePersona?.id ?? null;
  let createdPersonaId: string | null = null;
  if (!personaId) {
    const personaResponse = await page.request.post("/api/characters/personas", {
      data: { name: "Noodle Notification Regression", description: "Temporary browser regression persona." },
    });
    expect(personaResponse.ok()).toBe(true);
    const createdPersona = (await personaResponse.json()) as { id: string };
    personaId = createdPersona.id;
    createdPersonaId = createdPersona.id;
    const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
    expect(activateResponse.ok()).toBe(true);
  }

  await page.request.get("/api/noodle");
  const postResponse = await page.request.post("/api/noodle/posts", {
    data: {
      authorKind: "persona",
      authorEntityId: personaId,
      content: `Notification focus regression ${Date.now()}`,
    },
  });
  expect(postResponse.ok()).toBe(true);
  const post = (await postResponse.json()) as { id: string };

  try {
    const replyResponse = await page.request.post(`/api/noodle/posts/${post.id}/interactions`, {
      data: {
        actorKind: "character",
        actorEntityId: "__professor_mari__",
        type: "reply",
        content: "A focused reply regression check.",
      },
    });
    expect(replyResponse.ok()).toBe(true);
    const reply = (await replyResponse.json()) as { id: string };

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();

    const noodle = page.locator('[data-component="NoodleView"]');
    const notificationsButton = noodle.getByRole("button", { name: "Noodle notifications" });
    await expect(notificationsButton.locator('[data-component="NoodleView.NotificationBadge"]')).toBeVisible();
    await notificationsButton.click();
    await expect(noodle.locator('[data-component="NoodleView.NotificationBadge"]')).toHaveCount(0);
    await noodle.getByRole("button", { name: "Replies", exact: true }).click();

    const notification = noodle.locator(`[data-noodle-notification-target="${reply.id}"]`);
    await expect(notification).toBeVisible();
    await notification.click();

    const focusedReply = noodle.locator(`[data-noodle-interaction-id="${reply.id}"]`);
    await expect(focusedReply).toBeVisible();
    await expect(focusedReply).toBeFocused();
    await expect(focusedReply.getByTitle(/Like comment|Unlike comment/)).toBeVisible();
    await expect(focusedReply.getByTitle("Reply")).toBeVisible();

    await focusedReply.getByTitle("Reply").click();
    const nestedComposer = noodle.locator(
      `[data-component="NoodleView.ReplyComposer"][data-noodle-reply-parent-id="${reply.id}"]`,
    );
    await expect(nestedComposer).toBeVisible();
    await expect(nestedComposer).toContainText("Replying to");
    const [replyRect, composerRect] = await Promise.all([focusedReply.boundingBox(), nestedComposer.boundingBox()]);
    expect(replyRect).not.toBeNull();
    expect(composerRect).not.toBeNull();
    expect(composerRect!.y).toBeGreaterThanOrEqual(replyRect!.y + replyRect!.height - 1);
    expect(
      await nestedComposer.evaluate((composer, interactionId) => {
        const target = document.querySelector(`[data-noodle-interaction-id="${interactionId}"]`);
        return Boolean(target && target.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING);
      }, reply.id),
    ).toBe(true);

    await nestedComposer.getByTitle("Attach image").click();
    await expect(page.getByRole("heading", { name: "Add an image", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Image URL", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload from device", exact: true })).toHaveCSS(
      "background-color",
      "rgb(126, 167, 255)",
    );

    expect(errors).toEqual([]);
  } finally {
    await page.request.delete(`/api/noodle/posts/${post.id}`, { timeout: 5_000 }).catch(() => undefined);
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle only bumps posts when another account replies to the persona's comment", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Timeline bump ordering is covered on desktop.");

  const errors = collectUnexpectedErrors(page);
  const activePersonaResponse = await page.request.get("/api/characters/personas/active");
  const activePersona = activePersonaResponse.ok()
    ? ((await activePersonaResponse.json()) as { id?: string } | null)
    : null;
  let personaId = activePersona?.id ?? null;
  let createdPersonaId: string | null = null;
  if (!personaId) {
    const personaResponse = await page.request.post("/api/characters/personas", {
      data: { name: "Noodle Bump Regression", description: "Temporary browser regression persona." },
    });
    expect(personaResponse.ok()).toBe(true);
    const createdPersona = (await personaResponse.json()) as { id: string };
    personaId = createdPersona.id;
    createdPersonaId = createdPersona.id;
    const activateResponse = await page.request.put(`/api/characters/personas/${createdPersona.id}/activate`);
    expect(activateResponse.ok()).toBe(true);
  }

  await page.request.get("/api/noodle");
  const olderPostResponse = await page.request.post("/api/noodle/posts", {
    data: {
      authorKind: "character",
      authorEntityId: "__professor_mari__",
      content: `Older timeline bump regression ${Date.now()}`,
    },
  });
  expect(olderPostResponse.ok()).toBe(true);
  const olderPost = (await olderPostResponse.json()) as { id: string };
  await page.waitForTimeout(10);
  const newerPostResponse = await page.request.post("/api/noodle/posts", {
    data: {
      authorKind: "character",
      authorEntityId: "__professor_mari__",
      content: `Newer timeline bump regression ${Date.now()}`,
    },
  });
  expect(newerPostResponse.ok()).toBe(true);
  const newerPost = (await newerPostResponse.json()) as { id: string };

  try {
    const personaReplyResponse = await page.request.post(`/api/noodle/posts/${olderPost.id}/interactions`, {
      data: {
        actorKind: "persona",
        actorEntityId: personaId,
        type: "reply",
        content: "My comment should not bump this post.",
      },
    });
    expect(personaReplyResponse.ok()).toBe(true);
    const personaReply = (await personaReplyResponse.json()) as { id: string };

    const readRegressionOrder = async () =>
      page
        .locator("[data-noodle-post-id]")
        .evaluateAll(
          (elements, postIds) =>
            elements
              .map((element) => element.getAttribute("data-noodle-post-id"))
              .filter((postId): postId is string => postId !== null && postIds.includes(postId)),
          [olderPost.id, newerPost.id],
        );

    await page.goto("/");
    await page.locator('[data-tour="noodle-tab"]').click();
    await expect(page.locator(`[data-noodle-post-id="${olderPost.id}"]`)).toBeVisible();
    await expect.poll(readRegressionOrder).toEqual([newerPost.id, olderPost.id]);

    const characterReplyResponse = await page.request.post(`/api/noodle/posts/${olderPost.id}/interactions`, {
      data: {
        actorKind: "character",
        actorEntityId: "__professor_mari__",
        type: "reply",
        content: "Professor Mari directly replied to the persona comment.",
        parentInteractionId: personaReply.id,
      },
    });
    expect(characterReplyResponse.ok()).toBe(true);

    await page.reload();
    await page.locator('[data-tour="noodle-tab"]').click();
    await expect(page.locator(`[data-noodle-post-id="${olderPost.id}"]`)).toBeVisible();
    await expect.poll(readRegressionOrder).toEqual([olderPost.id, newerPost.id]);
    expect(errors).toEqual([]);
  } finally {
    await page.request.delete(`/api/noodle/posts/${olderPost.id}`, { timeout: 5_000 }).catch(() => undefined);
    await page.request.delete(`/api/noodle/posts/${newerPost.id}`, { timeout: 5_000 }).catch(() => undefined);
    if (createdPersonaId) {
      await page.request
        .delete(`/api/characters/personas/${createdPersonaId}`, { timeout: 5_000 })
        .catch(() => undefined);
    }
  }
});

test("Noodle uses its mobile shell when the desktop center pane is narrow", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop center-pane responsiveness is covered here.");

  const errors = collectUnexpectedErrors(page);
  await page.goto("/");
  await page.locator('[data-tour="noodle-tab"]').click();

  const center = page.locator('[data-component="CenterContent"]');
  const noodle = page.locator('[data-component="NoodleView"]');
  const desktopAccountSwitcher = noodle.locator('[data-component="NoodleView.AccountSwitcher"]');
  const mobileHeader = noodle.locator('[data-component="NoodleView.MobileHeader"]');
  const mobileBottomNav = noodle.locator('[data-component="NoodleView.MobileBottomNav"]');

  await expect(desktopAccountSwitcher).toBeVisible();
  await expect(mobileHeader).toBeHidden();
  await expect(mobileBottomNav).toBeHidden();

  await page.locator('[data-tour="sidebar-toggle"]').click();
  await page.locator('[data-tour="panel-settings"]').click();
  await expect.poll(() => center.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(1024);
  await expect(mobileHeader).toBeVisible();
  await expect(mobileBottomNav).toBeVisible();
  await expect(desktopAccountSwitcher).toBeHidden();

  await page.locator('[data-tour="panel-settings"]').click();
  await page.locator('[data-tour="sidebar-toggle"]').click();
  await expect(desktopAccountSwitcher).toBeVisible();
  await expect(mobileHeader).toBeHidden();
  await expect(mobileBottomNav).toBeHidden();

  await page.setViewportSize({ width: 900, height: 800 });
  await expect(mobileHeader).toBeVisible();
  await expect(mobileBottomNav).toBeVisible();
  await expect(desktopAccountSwitcher).toBeHidden();
  expect(errors).toEqual([]);
});

test("Noodle mobile shell keeps navigation usable across every view", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "The responsive Noodle shell is covered on mobile.");

  const errors = collectUnexpectedErrors(page);
  await page.goto("/");
  await page.locator('[data-tour="noodle-tab"]').click();

  const noodle = page.locator('[data-component="NoodleView"]');
  const header = noodle.locator('[data-component="NoodleView.MobileHeader"]');
  const bottomNav = noodle.locator('[data-component="NoodleView.MobileBottomNav"]');
  await expect(header).toBeVisible();
  await expect(bottomNav).toBeVisible();
  await expect(header.locator('img[src="/noodle-klusek.png"]')).toBeVisible();
  const bottomNavIconColors = await bottomNav
    .locator("svg:visible")
    .evaluateAll((icons) => Array.from(new Set(icons.map((icon) => getComputedStyle(icon).color))));
  expect(bottomNavIconColors.length).toBeGreaterThan(0);
  expect(bottomNavIconColors).toEqual(["rgb(126, 167, 255)"]);

  const [noodleRect, logoRect, bottomNavRect, bottomNavRowRect] = await Promise.all([
    noodle.boundingBox(),
    header.locator('img[src="/noodle-klusek.png"]').boundingBox(),
    bottomNav.boundingBox(),
    bottomNav.locator(":scope > div").boundingBox(),
  ]);
  expect(noodleRect).not.toBeNull();
  expect(logoRect).not.toBeNull();
  expect(bottomNavRect).not.toBeNull();
  expect(bottomNavRowRect).not.toBeNull();
  expect(Math.abs(logoRect!.x + logoRect!.width / 2 - (noodleRect!.x + noodleRect!.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(bottomNavRect!.y + bottomNavRect!.height - (noodleRect!.y + noodleRect!.height))).toBeLessThanOrEqual(
    1,
  );
  expect(bottomNavRowRect!.height).toBe(52);
  expect(bottomNavRect!.height).toBeLessThanOrEqual(58);

  const sawDrawerSlide = await page.evaluate(async () => {
    const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Open Noodle account menu"]');
    if (!trigger) return false;
    trigger.click();
    const positions: number[] = [];
    for (let frame = 0; frame < 10; frame += 1) {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const drawer = document.querySelector<HTMLElement>('[data-component="NoodleView.MobileDrawer"]');
      if (drawer) positions.push(drawer.getBoundingClientRect().x);
    }
    const first = positions[0];
    const last = positions.at(-1);
    return first !== undefined && last !== undefined && first < -1 && last > first + 10;
  });
  expect(sawDrawerSlide).toBe(true);

  const drawer = page.locator('[data-component="NoodleView.MobileDrawer"]');
  const accountMenu = page.getByRole("dialog", { name: "Noodle account menu" });
  await expect(accountMenu).toBeVisible();
  await expect.poll(() => drawer.evaluate((element) => Math.round(element.getBoundingClientRect().x))).toBe(0);
  const [drawerRect, topBarRect] = await Promise.all([
    drawer.boundingBox(),
    page.locator('[data-component="TopBar"]').boundingBox(),
  ]);
  expect(drawerRect).not.toBeNull();
  expect(topBarRect).not.toBeNull();
  expect(Math.abs(drawerRect!.x - noodleRect!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(drawerRect!.y - noodleRect!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(drawerRect!.width - noodleRect!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(drawerRect!.height - noodleRect!.height)).toBeLessThanOrEqual(1);
  expect(drawerRect!.y).toBeGreaterThanOrEqual(topBarRect!.y + topBarRect!.height - 1);
  for (const item of ["Home", "Profile", "Settings", "Post"]) {
    await expect(accountMenu.getByRole("button", { name: item, exact: true })).toBeVisible();
  }
  await expect(accountMenu.getByRole("button", { name: "Switch account" })).toBeVisible();

  const retainedDuringCollapse = await page.evaluate(async () => {
    const close = document.querySelector<HTMLButtonElement>('button[aria-label="Close Noodle account menu"]');
    close?.click();
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    return Boolean(document.querySelector('[data-component="NoodleView.MobileDrawer"]'));
  });
  expect(retainedDuringCollapse).toBe(true);
  await expect(drawer).toHaveCount(0);

  await bottomNav.getByRole("button", { name: "Open Noodle account menu" }).click();
  await expect(accountMenu).toBeVisible();
  await accountMenu.getByRole("button", { name: "Post", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  const composer = page.getByRole("heading", { name: "New post" });
  await expect(composer).toBeVisible();
  await page.getByRole("button", { name: "Close New post" }).click();

  await bottomNav.getByRole("button", { name: "Open Noodle account menu" }).click();
  await accountMenu.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(noodle.getByRole("heading", { name: "Noodle settings" })).toBeVisible();
  const promptSetting = noodle.locator('[data-component="NoodleView.PromptSetting"]');
  await expect(promptSetting).toBeVisible();
  const editPromptButton = promptSetting.getByRole("button", { name: "Edit prompt" });
  await expect(editPromptButton).toHaveCSS("justify-content", "center");
  await expect(editPromptButton.locator("svg")).toBeVisible();
  await expect(editPromptButton.locator("svg")).toHaveCSS("color", "rgb(126, 167, 255)");
  await editPromptButton.click();
  const promptEditor = page.locator('[data-component="ExpandedTextarea"]');
  await expect(promptEditor.getByRole("heading", { name: "Edit Noodle Prompt" })).toBeVisible();
  await promptEditor.getByRole("button", { name: "Cancel" }).first().click();
  await expect(promptEditor).toBeHidden();
  await expect(bottomNav).toBeVisible();
  await noodle.getByRole("button", { name: "Back to Noodle timeline" }).click();
  await expect(header).toBeVisible();

  await bottomNav.getByRole("button", { name: "Open Noodle account menu" }).click();
  await accountMenu.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(drawer).toHaveCount(0);

  const timelineScroller = noodle.locator('[data-component="NoodleView.TimelineScroller"]');
  await timelineScroller.evaluate((element) => {
    const content = element.firstElementChild as HTMLElement | null;
    if (content) content.style.minHeight = `${element.clientHeight + 100}px`;
    element.scrollTo({ top: element.scrollHeight });
  });
  expect(await timelineScroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await bottomNav.getByRole("button", { name: "Noodle home" }).click();
  await expect(header).toBeVisible();
  await expect.poll(() => timelineScroller.evaluate((element) => element.scrollTop)).toBe(0);

  await bottomNav.getByRole("button", { name: "Open Noodle account menu" }).click();
  await accountMenu.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(noodle.getByRole("heading", { name: "Profile", exact: true })).toBeVisible();
  await expect(bottomNav).toBeVisible();
  await noodle.getByRole("button", { name: "Back to Noodle timeline" }).click();
  await expect(header).toBeVisible();

  await bottomNav.getByRole("button", { name: "Search Noodle" }).click();
  const searchInput = noodle.getByRole("searchbox", { name: "Search Noodle" });
  await expect(searchInput).toBeVisible();
  await expect(noodle.getByRole("heading", { name: "Who to follow" })).toBeVisible();
  await expect(bottomNav).toBeVisible();
  await noodle.getByRole("button", { name: "Back to Noodle timeline" }).click();
  await expect(header).toBeVisible();

  await bottomNav.getByRole("button", { name: "Search Noodle" }).click();
  await searchInput.fill("Professor");
  await expect(noodle.getByRole("heading", { name: "Search results" })).toBeVisible();
  await bottomNav.getByRole("button", { name: "Noodle home" }).click();
  await expect(header).toBeVisible();
  await bottomNav.getByRole("button", { name: "Search Noodle" }).click();
  await expect(searchInput).toHaveValue("");

  await bottomNav.getByRole("button", { name: "Noodle notifications" }).click();
  await expect(noodle.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(bottomNav).toBeVisible();
  await noodle.getByRole("button", { name: "Back to Noodle timeline" }).click();
  await expect(header).toBeVisible();

  expect(errors).toEqual([]);
});

test("chat mode tabs and new-chat actions stay reachable", async ({ page }) => {
  const errors = collectUnexpectedErrors(page);
  await page.goto("/");

  await page.locator('[data-tour="sidebar-toggle"]').click();
  await expect(page.locator('[data-component="ChatSidebar"]')).toBeVisible();

  const modes = [
    { tour: "chat-mode-conversation", label: "New Conversation" },
    { tour: "chat-mode-roleplay", label: "New Roleplay" },
    { tour: "chat-mode-game", label: "New Game" },
  ];

  for (const mode of modes) {
    await page.locator(`[data-tour="${mode.tour}"]`).click();
    await expect(page.getByLabel(mode.label, { exact: true })).toBeVisible();
  }

  expect(errors).toEqual([]);
});

test("Roleplay reduced paint effects preserve semantic and custom styling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Reduced Roleplay paint styling is covered on desktop.");

  const characterResponse = await page.request.post("/api/characters", {
    data: {
      data: {
        name: "Reduced Paint Tint",
        extensions: { boxColor: "#123456" },
      },
    },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Reduced Roleplay Paint Smoke", mode: "roleplay", characterIds: [character.id] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  try {
    const userMessageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "user",
        content: "The default bubble should become transparent.",
      },
    });
    expect(userMessageResponse.ok()).toBeTruthy();
    const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        characterId: character.id,
        content: "A semantic ring must survive the lighter paint profile.",
        extra: { isConversationStart: true },
      },
    });
    expect(messageResponse.ok()).toBeTruthy();

    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");

    const surface = page.locator('[data-chat-mode="roleplay"]');
    const bubble = page.locator('[data-message-role="assistant"] .mari-rp-bubble').first();
    const defaultBubble = page.locator('[data-message-role="user"] .mari-rp-bubble').first();
    await expect(surface).not.toHaveClass(/mari-rp-reduced-paint/);
    await expect(bubble).toBeVisible();
    await expect(page.locator(".rpg-vignette")).not.toHaveCSS("display", "none");

    await page.locator('[data-tour="panel-settings"]').click();
    await page.getByRole("tab", { name: "Appearance" }).click();
    const reducedPaintToggle = page.getByLabel("Reduced paint effects");
    await reducedPaintToggle.scrollIntoViewIfNeeded();
    await page.getByText("Reduced paint effects", { exact: true }).click();
    await expect(reducedPaintToggle).toBeChecked();

    await expect(surface).toHaveClass(/mari-rp-reduced-paint/);
    const reducedStyles = await bubble.evaluate((element) => {
      const bubbleStyle = getComputedStyle(element);
      const overlayStyle = getComputedStyle(document.querySelector(".rpg-overlay")!);
      const vignetteStyle = getComputedStyle(document.querySelector(".rpg-vignette")!);
      return {
        backgroundImage: bubbleStyle.backgroundImage,
        boxShadow: bubbleStyle.boxShadow,
        dropShadow: bubbleStyle.getPropertyValue("--tw-shadow").trim(),
        overlayBackgroundImage: overlayStyle.backgroundImage,
        overlayBackgroundColor: overlayStyle.backgroundColor,
        vignetteDisplay: vignetteStyle.display,
      };
    });
    expect(reducedStyles.backgroundImage).toContain("linear-gradient");
    expect(reducedStyles.dropShadow).toBe("0 0 #0000");
    expect(reducedStyles.boxShadow).not.toBe("none");
    expect(reducedStyles.overlayBackgroundImage).toBe("none");
    expect(reducedStyles.overlayBackgroundColor).toBe("rgba(8, 8, 18, 0.5)");
    expect(reducedStyles.vignetteDisplay).toBe("none");

    await page.evaluate(() => {
      const style = document.createElement("style");
      style.id = "reduced-paint-card-css-smoke";
      style.textContent = ".mari-card-css .mari-message-bubble { background: rgb(1, 2, 3); }";
      document.head.append(style);
    });
    await expect(bubble).toHaveCSS("background-color", "rgb(1, 2, 3)");
    await expect(bubble).toHaveCSS("background-image", "none");
    await page.evaluate(() => document.getElementById("reduced-paint-card-css-smoke")?.remove());

    const opacitySlider = page.getByLabel("Roleplay Messages Background Opacity");
    await opacitySlider.focus();
    for (let step = 0; step < 18; step += 1) await opacitySlider.press("ArrowLeft");
    await expect(opacitySlider).toHaveValue("0");
    await expect(defaultBubble).toHaveAttribute("data-roleplay-bubble-transparent", "true");
    await expect(defaultBubble).toHaveCSS("background-image", "none");
    await expect(defaultBubble).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(bubble).not.toHaveAttribute("data-roleplay-bubble-transparent", "true");
    expect(await bubble.evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("rgb(18, 52, 86)");

    await expect
      .poll(() =>
        page.evaluate(() => {
          const persisted = JSON.parse(localStorage.getItem("marinara-engine-ui") ?? '{"state":{}}') as {
            state?: { roleplayReducedPaintEffects?: unknown; chatFontOpacity?: unknown };
          };
          return [persisted.state?.roleplayReducedPaintEffects, persisted.state?.chatFontOpacity];
        }),
      )
      .toEqual([true, 0]);

    await page.reload();
    await expect(surface).toHaveClass(/mari-rp-reduced-paint/);
    await expect(defaultBubble).toHaveAttribute("data-roleplay-bubble-transparent", "true");
    await expect(bubble).not.toHaveAttribute("data-roleplay-bubble-transparent", "true");
    await expect(bubble).not.toHaveCSS("box-shadow", "none");
  } finally {
    await Promise.all([
      page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined),
      page.request.delete(`/api/characters/${character.id}`).catch(() => undefined),
    ]);
  }
});

test("memory recall modal accepts clicks from chat settings", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Memory recall modal regression is covered on desktop.");

  const response = await page.request.post("/api/chats", {
    data: {
      name: "Memory Recall Menu Smoke",
      mode: "conversation",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };

  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);
  await page.goto("/");

  await page.getByRole("button", { name: "Chat Settings" }).click();
  const drawer = page.locator(".mari-chat-settings-drawer");
  await expect(drawer.getByRole("heading", { name: "Chat Settings" })).toBeVisible();
  await drawer.getByText("Memory Recall", { exact: true }).click();
  await drawer.getByRole("button", { name: "Access memories for this chat" }).click();

  const dialog = page.getByRole("dialog", { name: "Memories for This Chat" });
  await expect(dialog).toBeVisible();
  await dialog.getByText("0 memory chunks").click();
  await expect(dialog).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Chat Settings" })).toBeVisible();
});

test("mobile chat composer follows the visual viewport above the software keyboard", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Software-keyboard viewport behavior is mobile-only.");

  const response = await page.request.post("/api/chats", {
    data: {
      name: "Mobile Keyboard Viewport Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  for (let index = 0; index < 18; index += 1) {
    const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: index % 2 === 0 ? "user" : "assistant",
        content: `Keyboard viewport history line ${index + 1}. ${"Keep the latest turn visible. ".repeat(3)}`,
      },
    });
    expect(messageResponse.ok()).toBeTruthy();
  }

  await page.addInitScript(() => {
    const state = {
      height: null as number | null,
      offsetTop: 0,
    };
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { configurable: true, get: () => state.height ?? window.innerHeight },
      offsetTop: { configurable: true, get: () => state.offsetTop },
      offsetLeft: { configurable: true, get: () => 0 },
      pageLeft: { configurable: true, get: () => 0 },
      pageTop: { configurable: true, get: () => state.offsetTop },
      scale: { configurable: true, get: () => 1 },
      width: { configurable: true, get: () => window.innerWidth },
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    Object.defineProperty(window, "__setMarinaraVisualViewport", {
      configurable: true,
      value: (height: number, offsetTop: number) => {
        state.height = height;
        state.offsetTop = offsetTop;
        viewport.dispatchEvent(new Event("resize"));
        viewport.dispatchEvent(new Event("scroll"));
      },
    });
    Object.defineProperty(window, "__rotateMarinaraVisualViewport", {
      configurable: true,
      value: (height: number) => {
        state.height = height;
        state.offsetTop = 0;
        window.dispatchEvent(new Event("orientationchange"));
        viewport.dispatchEvent(new Event("resize"));
      },
    });
  });
  await page.addInitScript((chatId) => {
    localStorage.setItem("marinara-active-chat-id", chatId);
  }, chat.id);

  try {
    await page.goto("/");
    await page.locator("html").evaluate((element) => {
      element.style.setProperty("--mari-safe-area-inset-bottom", "34px");
    });

    const viewportMeta = page.locator('meta[name="viewport"]');
    await expect(viewportMeta).toHaveAttribute("content", /interactive-widget=resizes-content/);

    const shell = page.locator('[data-component="AppShell"]');
    const composer = page.locator(".chat-input-container:visible");
    const textarea = composer.locator("textarea:visible");
    const transcript = page.locator(".mari-messages-scroll:visible").first();
    await expect(transcript).toBeVisible();
    await expect(page.getByText(/^Keyboard viewport history line 18\./)).toBeVisible();
    await expect
      .poll(() => transcript.evaluate((element) => element.scrollHeight - element.clientHeight))
      .toBeGreaterThan(400);
    await transcript.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect
      .poll(() => transcript.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight))
      .toBeLessThanOrEqual(2);
    await expect(textarea).toBeVisible();
    await expect.poll(() => composer.evaluate((element) => getComputedStyle(element).paddingBottom)).toBe("34px");

    const initialViewportHeight = await page.evaluate(() => window.innerHeight);
    const rotatedViewportHeight = Math.max(240, initialViewportHeight - 200);
    await page.evaluate((height) => {
      (
        window as typeof window & {
          __rotateMarinaraVisualViewport: (height: number) => void;
        }
      ).__rotateMarinaraVisualViewport(height);
    }, rotatedViewportHeight);
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--mari-visual-viewport-height").trim(),
        ),
      )
      .toBe(`${rotatedViewportHeight}px`);
    await expect(page.locator("html")).not.toHaveAttribute("data-mari-software-keyboard-open", "");
    await expect.poll(() => composer.evaluate((element) => getComputedStyle(element).paddingBottom)).toBe("34px");

    await page.evaluate((height) => {
      (
        window as typeof window & {
          __rotateMarinaraVisualViewport: (height: number) => void;
        }
      ).__rotateMarinaraVisualViewport(height);
    }, initialViewportHeight);
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--mari-visual-viewport-height").trim(),
        ),
      )
      .toBe(`${initialViewportHeight}px`);
    await expect(page.locator("html")).not.toHaveAttribute("data-mari-software-keyboard-open", "");
    await page.waitForTimeout(350);

    await textarea.focus();

    await page.evaluate(() => {
      (
        window as typeof window & {
          __setMarinaraVisualViewport: (height: number, offsetTop: number) => void;
        }
      ).__setMarinaraVisualViewport(360, 72);
    });

    await expect
      .poll(() =>
        page.evaluate(() => ({
          height: getComputedStyle(document.documentElement).getPropertyValue("--mari-visual-viewport-height").trim(),
          top: getComputedStyle(document.documentElement).getPropertyValue("--mari-visual-viewport-offset-top").trim(),
        })),
      )
      .toEqual({ height: "360px", top: "72px" });
    await expect(page.locator("html")).toHaveAttribute("data-mari-software-keyboard-open", "");
    const compactComposerStyle = await composer.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontSize: Number.parseFloat(style.fontSize),
        paddingBottom: Number.parseFloat(style.paddingBottom),
      };
    });
    expect(compactComposerStyle.paddingBottom).toBeCloseTo(compactComposerStyle.fontSize * 0.5, 5);

    const [shellBox, composerBox] = await Promise.all([shell.boundingBox(), composer.boundingBox()]);
    expect(shellBox).not.toBeNull();
    expect(composerBox).not.toBeNull();
    expect(Math.abs(shellBox!.y - 72)).toBeLessThanOrEqual(1);
    expect(Math.abs(shellBox!.height - 360)).toBeLessThanOrEqual(1);
    expect(composerBox!.y).toBeGreaterThanOrEqual(72);
    expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(432);
    await expect
      .poll(() => transcript.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight))
      .toBeLessThanOrEqual(2);

    // Let the delayed focus viewport samples settle before simulating a user
    // deliberately scrolling away from the latest message.
    await page.waitForTimeout(350);
    await transcript.evaluate((element) => {
      element.scrollTop = Math.max(0, element.scrollTop - 320);
    });
    await expect
      .poll(() => transcript.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight))
      .toBeGreaterThan(180);
    await expect(textarea).toBeVisible();

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "userAgent", {
        configurable: true,
        value:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 " +
          "(KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
      });
    });
    await page.reload();
    await page.locator("html").evaluate((element) => {
      element.style.setProperty("--mari-safe-area-inset-bottom", "34px");
    });
    await expect(page.getByText(/^Keyboard viewport history line 18\./)).toBeVisible();
    await textarea.focus();
    await page.evaluate(() => {
      (
        window as typeof window & {
          __setMarinaraVisualViewport: (height: number, offsetTop: number) => void;
        }
      ).__setMarinaraVisualViewport(360, 72);
    });

    await expect
      .poll(() =>
        page.evaluate(() => ({
          height: getComputedStyle(document.documentElement).getPropertyValue("--mari-visual-viewport-height").trim(),
          top: getComputedStyle(document.documentElement).getPropertyValue("--mari-visual-viewport-offset-top").trim(),
        })),
      )
      .toEqual({ height: "360px", top: "0px" });
    await expect(page.locator("html")).toHaveAttribute("data-mari-software-keyboard-open", "");
    const iosCompactComposerStyle = await composer.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        fontSize: Number.parseFloat(style.fontSize),
        paddingBottom: Number.parseFloat(style.paddingBottom),
      };
    });
    expect(iosCompactComposerStyle.paddingBottom).toBeCloseTo(iosCompactComposerStyle.fontSize * 0.5, 5);

    const [iosShellBox, iosComposerBox] = await Promise.all([shell.boundingBox(), composer.boundingBox()]);
    expect(iosShellBox).not.toBeNull();
    expect(iosComposerBox).not.toBeNull();
    expect(Math.abs(iosShellBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(iosShellBox!.height - 360)).toBeLessThanOrEqual(1);
    expect(iosComposerBox!.y).toBeGreaterThanOrEqual(0);
    expect(iosComposerBox!.y + iosComposerBox!.height).toBeLessThanOrEqual(360);

    await page.evaluate(async () => {
      const storePath = "/src/stores/ui.store.ts";
      const { useUIStore } = (await import(/* @vite-ignore */ storePath)) as {
        useUIStore: {
          getState: () => {
            setAppBackgroundColor: (color: string) => void;
            setVisualTheme: (theme: "default" | "sillytavern") => void;
          };
        };
      };
      useUIStore.getState().setAppBackgroundColor("#123456");
    });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          html: document.documentElement.style.getPropertyValue("background-color"),
          body: document.body.style.getPropertyValue("background-color"),
        })),
      )
      .toEqual({ html: "rgb(18, 52, 86)", body: "rgb(18, 52, 86)" });

    await page.evaluate(async () => {
      const storePath = "/src/stores/ui.store.ts";
      const { useUIStore } = (await import(/* @vite-ignore */ storePath)) as {
        useUIStore: {
          getState: () => {
            setAppBackgroundColor: (color: string) => void;
            setVisualTheme: (theme: "default" | "sillytavern") => void;
          };
        };
      };
      const style = document.createElement("style");
      style.id = "marinara-safe-area-theme-smoke";
      style.textContent = 'html[data-visual-theme="sillytavern"][data-theme] { --background: rgb(101, 67, 33); }';
      document.head.appendChild(style);
      useUIStore.getState().setAppBackgroundColor("");
      useUIStore.getState().setVisualTheme("sillytavern");
    });
    await expect
      .poll(() =>
        page.evaluate(() => ({
          html: document.documentElement.style.getPropertyValue("background-color"),
          body: document.body.style.getPropertyValue("background-color"),
        })),
      )
      .toEqual({ html: "rgb(101, 67, 33)", body: "rgb(101, 67, 33)" });

    await page.evaluate(() => {
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        get: () => 64,
      });
      window.visualViewport?.dispatchEvent(new Event("scroll"));
    });
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--mari-app-scroll-compensate").trim(),
        ),
      )
      .toBe("64px");
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.querySelector<HTMLElement>(".mari-app")!).transform))
      .toContain("64");

    await page.evaluate(async () => {
      const storePath = "/src/stores/ui.store.ts";
      const { useUIStore } = (await import(/* @vite-ignore */ storePath)) as {
        useUIStore: {
          getState: () => {
            openBotBrowser: () => void;
          };
        };
      };
      useUIStore.getState().openBotBrowser();
    });
    await expect(shell).not.toHaveAttribute("data-chat-surface-active");
    await expect.poll(() => shell.evaluate((element) => getComputedStyle(element).transform)).toBe("none");

    await page.evaluate(async (chatId) => {
      const storePath = "/src/stores/ui.store.ts";
      const { useUIStore } = (await import(/* @vite-ignore */ storePath)) as {
        useUIStore: {
          getState: () => {
            closeBotBrowser: () => void;
            setTrackerPanelEnabled: (enabled: boolean) => void;
            setTrackerPanelOpen: (open: boolean, chatId?: string | null) => void;
          };
        };
      };
      const store = useUIStore.getState();
      store.closeBotBrowser();
      store.setTrackerPanelEnabled(true);
      store.setTrackerPanelOpen(true, chatId);
    }, chat.id);
    await expect(shell).not.toHaveAttribute("data-chat-surface-active");
    await expect.poll(() => shell.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("focused mobile composers stay open while history scrolls in Conversation and Roleplay", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Focused composer history behavior is mobile-only.");

  const chatIds: string[] = [];
  try {
    await page.goto("/");
    for (const mode of ["conversation", "roleplay"] as const) {
      const response = await page.request.post("/api/chats", {
        data: {
          name: `${mode} focused composer smoke`,
          mode,
          characterIds: [],
        },
      });
      expect(response.ok()).toBeTruthy();
      const chat = (await response.json()) as { id: string };
      chatIds.push(chat.id);
      for (let index = 0; index < 18; index += 1) {
        const messageResponse = await page.request.post(`/api/chats/${chat.id}/messages`, {
          data: {
            role: index % 2 === 0 ? "user" : "assistant",
            content: `${mode} focused composer history ${index + 1}. ${"Scrollable context. ".repeat(4)}`,
          },
        });
        expect(messageResponse.ok()).toBeTruthy();
      }

      await page.evaluate((chatId) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
      }, chat.id);
      await page.reload();

      const transcript = page.locator(".mari-messages-scroll:visible").first();
      const textarea = page.locator('[data-chat-composer="true"]:visible');
      await expect(page.locator(`[data-chat-mode="${mode}"]`)).toBeVisible();
      await expect(transcript).toBeVisible();
      await expect
        .poll(() => transcript.evaluate((element) => element.scrollHeight - element.clientHeight))
        .toBeGreaterThan(400);
      await transcript.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await textarea.focus();
      await expect(textarea).toBeFocused();

      await transcript.evaluate((element) => {
        element.scrollTop = Math.max(0, element.scrollTop - 320);
      });
      await expect
        .poll(() => transcript.evaluate((element) => element.scrollHeight - element.scrollTop - element.clientHeight))
        .toBeGreaterThan(180);
      await expect(textarea).toBeFocused();
      await expect(textarea).toBeVisible();
    }
  } finally {
    await Promise.all(chatIds.map((chatId) => page.request.delete(`/api/chats/${chatId}`).catch(() => undefined)));
  }
});

test("Conversation media searches match GIFs and internal presses keep the picker open", async ({ page }) => {
  const response = await page.request.post("/api/chats", {
    data: {
      name: "Kaomoji Scrollbar Smoke",
      mode: "conversation",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    const mediaButton = page.getByRole("button", { name: /Emoji, GIFs/u });
    await mediaButton.click();
    const mediaPicker = page.locator("[data-conversation-media-picker]:visible");
    await expect(mediaPicker).toBeVisible();
    const emojiSearchInput = page.getByRole("textbox", { name: "Search emojis", exact: true });
    const emojiSearchStyle = await emojiSearchInput.evaluate((input) => {
      const style = getComputedStyle(input);
      const shellStyle = getComputedStyle(input.parentElement!);
      return {
        backgroundColor: shellStyle.backgroundColor,
        borderRadius: shellStyle.borderRadius,
        fontSize: style.fontSize,
        paddingBlock: `${shellStyle.paddingTop} ${shellStyle.paddingBottom}`,
        paddingInline: `${shellStyle.paddingLeft} ${shellStyle.paddingRight}`,
      };
    });
    await mediaPicker.getByRole("button", { name: "Kaomoji", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Kaomoji picker" });
    await expect(picker).toBeVisible();

    const [categoriesFit, resultsFit] = await Promise.all([
      picker.locator("[data-kaomoji-categories]").evaluate((element) => element.scrollWidth <= element.clientWidth),
      picker.locator("[data-kaomoji-results]").evaluate((element) => element.scrollWidth <= element.clientWidth),
    ]);
    expect(categoriesFit).toBe(true);
    expect(resultsFit).toBe(true);

    const searchInput = picker.getByPlaceholder("Search kaomoji…");
    const kaomojiSearchStyle = await searchInput.evaluate((input) => {
      const inputStyle = getComputedStyle(input);
      const shellStyle = getComputedStyle(input.parentElement!);
      return {
        backgroundColor: shellStyle.backgroundColor,
        borderRadius: shellStyle.borderRadius,
        fontSize: inputStyle.fontSize,
        paddingBlock: `${shellStyle.paddingTop} ${shellStyle.paddingBottom}`,
        paddingInline: `${shellStyle.paddingLeft} ${shellStyle.paddingRight}`,
      };
    });
    await picker.locator("[data-kaomoji-results]").dispatchEvent("pointerdown");
    await expect(mediaPicker).toBeVisible();

    await mediaPicker.getByRole("button", { name: "GIFs", exact: true }).click();
    const gifSearchInput = page.getByRole("textbox", { name: "Search for GIFs", exact: true });
    const gifSearchStyle = await gifSearchInput.evaluate((input) => {
      const inputStyle = getComputedStyle(input);
      const shellStyle = getComputedStyle(input.parentElement!);
      return {
        backgroundColor: shellStyle.backgroundColor,
        borderRadius: shellStyle.borderRadius,
        fontSize: inputStyle.fontSize,
        paddingBlock: `${shellStyle.paddingTop} ${shellStyle.paddingBottom}`,
        paddingInline: `${shellStyle.paddingLeft} ${shellStyle.paddingRight}`,
      };
    });
    expect(emojiSearchStyle).toEqual(gifSearchStyle);
    expect(kaomojiSearchStyle).toEqual(gifSearchStyle);
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("media pickers persist and surface recently used items", async ({ page }, testInfo) => {
  const projectSuffix = testInfo.project.name.includes("mobile") ? "mobile" : "desktop";
  const stickerName = `recent_${projectSuffix}_${Date.now().toString(36)}`.slice(0, 32);
  const stickerResponse = await page.request.post("/api/custom-stickers/upload", {
    multipart: {
      file: {
        name: `${stickerName}.gif`,
        mimeType: "image/gif",
        buffer: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
      },
      name: stickerName,
    },
  });
  expect(stickerResponse.ok()).toBeTruthy();
  const sticker = (await stickerResponse.json()) as { id: string; name: string; url: string };

  const response = await page.request.post("/api/chats", {
    data: {
      name: "Recent media smoke",
      mode: "conversation",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const recentGif = `data:image/gif;base64,${TRANSPARENT_GIF_BASE64}`;

  try {
    await page.addInitScript(
      ({ chatId, gifUrl, stickerValue, stickerUrl }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem(
          "marinara-recent-media-v1",
          JSON.stringify({
            emoji: [{ value: "🌶️", label: "hot pepper" }],
            kaomoji: [{ value: "(づ｡◕‿‿◕｡)づ", label: "(づ｡◕‿‿◕｡)づ" }],
            gif: [{ value: gifUrl, label: "Recent GIF", previewUrl: gifUrl }],
            sticker: [{ value: stickerValue, label: stickerValue, previewUrl: stickerUrl }],
          }),
        );
      },
      { chatId: chat.id, gifUrl: recentGif, stickerValue: sticker.name, stickerUrl: sticker.url },
    );
    await page.goto("/");

    const mediaButton = page.getByRole("button", { name: /Emoji, GIFs/u });
    await mediaButton.click();
    const mediaPicker = page.locator("[data-conversation-media-picker]:visible");
    await expect(mediaPicker).toBeVisible();

    const recentEmoji = mediaPicker.locator('[data-recent-media="emoji"]');
    await expect(recentEmoji).toContainText("Recently used");
    await expect(recentEmoji.getByRole("button", { name: "hot pepper" })).toBeVisible();
    const emojiSearch = mediaPicker.getByRole("textbox", { name: "Search emojis" });
    await emojiSearch.fill("test tube");
    await mediaPicker.getByRole("button", { name: /test tube/i }).click();
    await expect(mediaPicker).toBeHidden();
    await mediaButton.click();
    await expect(recentEmoji.getByRole("button", { name: /test tube/i })).toBeVisible();

    await mediaPicker.getByRole("button", { name: "Kaomoji", exact: true }).click();
    const kaomojiPicker = mediaPicker.getByRole("dialog", { name: "Kaomoji picker" });
    const recentKaomoji = kaomojiPicker.locator('[data-recent-media="kaomoji"]');
    await expect(recentKaomoji).toContainText("(づ｡◕‿‿◕｡)づ");
    const kaomojiOptions = kaomojiPicker.locator("[data-kaomoji-results] > div.grid button");
    const kaomojiValues = (await kaomojiOptions.allTextContents()).map((value) => value.trim());
    const newKaomojiIndex = kaomojiValues.findIndex((value) => value !== "(づ｡◕‿‿◕｡)づ");
    expect(newKaomojiIndex).toBeGreaterThanOrEqual(0);
    const newKaomoji = kaomojiOptions.nth(newKaomojiIndex);
    const newKaomojiValue = (await newKaomoji.textContent())?.trim();
    expect(newKaomojiValue).toBeTruthy();
    await newKaomoji.click();
    await expect(mediaPicker).toBeHidden();
    await mediaButton.click();
    await mediaPicker.getByRole("button", { name: "Kaomoji", exact: true }).click();
    await expect(recentKaomoji.locator("button").first()).toContainText(newKaomojiValue!);

    await mediaPicker.getByRole("button", { name: "GIFs", exact: true }).click();
    const recentGifSection = mediaPicker.locator('[data-recent-media="gif"]');
    await expect(recentGifSection).toContainText("Recently used");
    await expect(recentGifSection.locator('[title="Recent GIF"]')).toBeVisible();

    await mediaPicker.getByRole("button", { name: "Stickers", exact: true }).click();
    const recentStickerSection = mediaPicker.locator('[data-recent-media="sticker"]');
    await expect(recentStickerSection).toContainText("Recently used");
    await expect(recentStickerSection.locator(`[title="Send sticker:${stickerName}:"]`)).toBeVisible();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("marinara-recent-media-v1") ?? "{}"));
    expect(stored.emoji[0].value).toBe("🧪");
    expect(stored.kaomoji[0].value).toBe(newKaomojiValue);

    await page.evaluate(() => {
      localStorage.removeItem("marinara-recent-media-v1");
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    await expect(recentStickerSection).toHaveCount(0);
  } finally {
    await page.request.delete(`/api/custom-stickers/${sticker.id}`).catch(() => undefined);
    await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("Roleplay composer does not offer kaomoji", async ({ page }) => {
  const response = await page.request.post("/api/chats", {
    data: {
      name: "Roleplay Without Kaomoji",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };

  try {
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    await expect(page.locator(".chat-input-container textarea:visible")).toBeVisible();
    await expect(page.getByRole("button", { name: "Kaomoji" })).toHaveCount(0);
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

test("mobile topbar remains reachable while sidebars switch", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "Mobile shell smoke only runs in the mobile project.");

  const errors = collectUnexpectedErrors(page);
  await page.goto("/");

  await page.locator('[data-tour="sidebar-toggle"]').click();
  await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
  await expect(page.locator('[data-component="ChatSidebar"]')).toBeVisible();
  const mobileChatSidebar = page.locator('[data-component="ChatSidebarPanel"]');
  const openMobileSidebarX = (await mobileChatSidebar.boundingBox())?.x ?? 0;
  await page.locator('[data-tour="sidebar-toggle"]').click();
  await expect(mobileChatSidebar).toHaveClass(/mari-shell-panel-exit-left/);
  expect((await mobileChatSidebar.boundingBox())?.width ?? 0).toBeGreaterThan(
    (await page.evaluate(() => innerWidth)) * 0.9,
  );
  await expect
    .poll(async () => (await mobileChatSidebar.boundingBox())?.x ?? Number.POSITIVE_INFINITY)
    .toBeLessThan(openMobileSidebarX - 8);
  await expect(mobileChatSidebar).toHaveAttribute("aria-hidden", "true");

  await page.locator('[data-tour="sidebar-toggle"]').click();
  await expect(page.locator('[data-component="ChatSidebar"]')).toBeVisible();

  await page.locator('[data-tour="panel-characters"]').click();
  await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
  await expect(page.locator('[data-component="RightPanelMobile"]')).toBeVisible();

  await page.locator('[data-tour="panel-settings"]').click();
  await expect(page.locator('[data-component="TopBar"]')).toBeVisible();
  await expect(page.locator('[data-component="RightPanelMobile"]')).toBeVisible();

  expect(errors).toEqual([]);
});

test("mobile Game keeps CYOA usable above four HUD widgets", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"), "The Game viewport-pressure regression is mobile-only.");

  const errors = collectUnexpectedErrors(page);
  await expect.poll(async () => (await request.get("/api/health")).ok()).toBe(true);
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Mobile Game CYOA Viewport Smoke", mode: "game", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };

  const hudWidgets = [
    {
      id: "widget-floor",
      type: "counter",
      label: "Dungeon Floor",
      icon: "🗼",
      position: "hud_left",
      accent: "#9B6CFF",
      config: { count: 1 },
    },
    {
      id: "widget-exp",
      type: "progress_bar",
      label: "EXP to Next Level",
      icon: "✨",
      position: "hud_left",
      accent: "#4FD6FF",
      config: { value: 20, max: 100 },
    },
    {
      id: "widget-bonds",
      type: "stat_block",
      label: "Party Bonds",
      icon: "💞",
      position: "hud_right",
      accent: "#FF69B4",
      config: { stats: [{ name: "Ally", value: 40 }] },
    },
    {
      id: "widget-pressure",
      type: "gauge",
      label: "Curse Pressure",
      icon: "💜",
      position: "hud_right",
      accent: "#C43DFF",
      config: { value: 10, max: 100 },
    },
  ];

  try {
    const metadataResponse = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        gameId: "mobile-cyoa-viewport-smoke",
        gameSessionStatus: "active",
        gameSessionNumber: 1,
        gameIntroPresented: true,
        gameActiveState: "dialogue",
        enableAgents: false,
        activeAgentIds: [],
        enableCustomWidgets: true,
        gameBlueprint: {
          campaignPlan: {},
          hudWidgets,
          introSequence: [],
          visualTheme: {},
        },
      },
    });
    expect(metadataResponse.ok()).toBeTruthy();

    const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content:
          'The party reaches a fork in the flooded vault.\n\n[choices: "Take the surveyed stairs through the glowing nests"|"Risk the faster waterway before the chamber floods"|"Follow the unstable violet route into the unknown"]',
      },
    });
    expect(messageResponse.ok()).toBeTruthy();

    await page.route("**/api/game-assets/manifest", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ scannedAt: "2026-07-16T00:00:00.000Z", count: 0, assets: {}, byCategory: {} }),
      });
    });
    await page.route("**/api/backgrounds/file/Black.jpg**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "image/gif",
        body: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
      });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem(
        "marinara-engine-ui",
        JSON.stringify({
          state: {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            gameTextSpeed: 100,
          },
          version: 65,
        }),
      );
    }, chat.id);

    await page.goto("/");
    const choiceStage = page.locator('[data-component="GameSurface.MobileChoiceStage"]');
    const choiceStack = page.locator('[data-component="GameSurface.MobileChoiceStack"]');
    const leftWidgetRail = page.locator('[data-component="GameSurface.MobileWidgetRailLeft"]');
    const rightWidgetRail = page.locator('[data-component="GameSurface.MobileWidgetRailRight"]');
    const narrationPanel = page.locator('[data-component="GameNarration.ActivePanel"]');
    const composer = page.getByPlaceholder("What do you do?");
    const optionList = page.locator('[data-component="GameChoiceCards.Options"]');
    const options = page.locator('[data-component="GameChoiceCards.Options"] > button');
    await expect(choiceStage).toBeVisible();
    await expect(choiceStack).toBeVisible();
    await expect(leftWidgetRail).toBeVisible();
    await expect(rightWidgetRail).toBeVisible();
    await expect(composer).toBeVisible();
    await expect(options).toHaveCount(3);

    const viewport = { width: 390, height: 700 };
    await page.setViewportSize(viewport);
    await expect(page.getByTitle("Game actions")).toBeVisible();
    await expect(page.locator('[data-tour="game-map"]').getByRole("button", { name: "Open map" })).toBeVisible();

    await expect
      .poll(async () => {
        const stageRect = await choiceStage.boundingBox();
        const choiceRect = await choiceStack.boundingBox();
        const leftWidgetRect = await leftWidgetRail.boundingBox();
        const rightWidgetRect = await rightWidgetRail.boundingBox();
        const narrationRect = await narrationPanel.boundingBox();
        const composerRect = await composer.boundingBox();
        if (!stageRect || !choiceRect || !leftWidgetRect || !rightWidgetRect || !narrationRect || !composerRect) {
          return null;
        }
        return {
          choiceFillsCenter: choiceRect.height >= stageRect.height - 1,
          choiceBetweenWidgets:
            leftWidgetRect.x + leftWidgetRect.width <= choiceRect.x + 1 &&
            choiceRect.x + choiceRect.width <= rightWidgetRect.x + 1,
          widgetsShareChoiceBand:
            leftWidgetRect.y >= stageRect.y - 1 &&
            leftWidgetRect.y + leftWidgetRect.height <= stageRect.y + stageRect.height + 1 &&
            rightWidgetRect.y >= stageRect.y - 1 &&
            rightWidgetRect.y + rightWidgetRect.height <= stageRect.y + stageRect.height + 1,
          choiceStageBeforeNarration: stageRect.y + stageRect.height <= narrationRect.y + 1,
          narrationStartsInViewport: narrationRect.y >= 0 && narrationRect.y < viewport.height,
          composerFullyInViewport: composerRect.y >= 0 && composerRect.y + composerRect.height <= viewport.height + 1,
        };
      })
      .toEqual({
        choiceFillsCenter: true,
        choiceBetweenWidgets: true,
        widgetsShareChoiceBand: true,
        choiceStageBeforeNarration: true,
        narrationStartsInViewport: true,
        composerFullyInViewport: true,
      });

    await optionList.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(page.getByText("Choose your action", { exact: true })).toBeVisible();
    await expect(options.last()).toBeVisible();
    const optionListRect = await optionList.boundingBox();
    const lastOptionRect = await options.last().boundingBox();
    expect(optionListRect).not.toBeNull();
    expect(lastOptionRect).not.toBeNull();
    expect(lastOptionRect!.y).toBeGreaterThanOrEqual(optionListRect!.y - 1);
    expect(lastOptionRect!.y + lastOptionRect!.height).toBeLessThanOrEqual(
      optionListRect!.y + optionListRect!.height + 1,
    );
    await expect(page.getByText("The party reaches a fork in the flooded vault.", { exact: true })).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
  }
});

test("Background cards keep names readable and load thumbnails", async ({ page }, testInfo) => {
  await page.route("**/api/backgrounds", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "user:collapsible-background-tags.png",
          filename: "collapsible-background-tags.png",
          url: "/api/backgrounds/file/collapsible-background-tags.png",
          tags: ["fontaine", "rainy night", "quarantine berth", "warm interior"],
          source: "user",
          createdAt: "2026-07-27T00:00:00.000Z",
          folderId: null,
        },
      ]),
    });
  });

  await page.goto("/");
  await page.locator('[data-tour="panel-settings"]').click();
  await page.getByRole("tab", { name: "Appearance" }).click();
  await page.getByPlaceholder("Search settings").fill("Backgrounds");
  await page.getByRole("button", { name: /Backgrounds Section/ }).click();
  await page.getByRole("button", { name: "Browse library" }).click();
  await expect(page.getByRole("dialog", { name: "Background Library" })).toBeVisible();

  const card = page.locator('[data-background-id="user:collapsible-background-tags.png"]');
  await expect(card).toBeVisible();
  await expect(card.getByText("quarantine berth", { exact: true })).toBeVisible();
  // Cards request the cached thumbnail, never the full-size original.
  await expect(card.locator("img")).toHaveAttribute("src", /\?w=320$/);
  await expect(card.locator("img")).toHaveAttribute("loading", "lazy");

  if (!testInfo.project.name.includes("mobile")) {
    await card.hover();
    const [nameBox, actionBox] = await Promise.all([
      card.locator("[data-background-name]").boundingBox(),
      card.locator("[data-background-actions]").boundingBox(),
    ]);
    expect(nameBox).not.toBeNull();
    expect(actionBox).not.toBeNull();
    expect(nameBox!.width).toBeGreaterThanOrEqual(60);

    await card.locator("[data-background-edit-tags]").click();
    const tagInputBox = await card.locator("[data-background-tag-input]").boundingBox();
    expect(tagInputBox).not.toBeNull();
    expect(tagInputBox!.width).toBeGreaterThanOrEqual(80);
    await card.locator("[data-background-edit-tags]").click();
  }

  // The action row is always visible on touch, so it must sit above the tag chips rather than
  // float over them the way it does on hover-capable pointers.
  if (testInfo.project.name.includes("mobile")) {
    const [actionsBox, tagBox] = await Promise.all([
      card.locator("[data-background-actions]").boundingBox(),
      card.getByText("quarantine berth", { exact: true }).boundingBox(),
    ]);
    expect(actionsBox).not.toBeNull();
    expect(tagBox).not.toBeNull();
    expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(tagBox!.y);
    // Touch targets stay tappable.
    expect(actionsBox!.height).toBeGreaterThanOrEqual(36);
  }

  await card.getByRole("button", { name: /Use .* for this chat/ }).click();
  // Selecting closes the modal, so the card detaches. Re-open and assert the persisted selection.
  await expect(page.getByRole("dialog", { name: "Background Library" })).toBeHidden();
  await page.getByRole("button", { name: "Browse library" }).click();
  await expect(page.getByRole("dialog", { name: "Background Library" })).toBeVisible();
  await expect(page.locator('[data-background-id="user:collapsible-background-tags.png"]')).toHaveAttribute(
    "data-background-selected",
    "true",
  );
});

test("Roleplay displays a selected background when its file route is GET-only", async ({ page }, testInfo) => {
  const chatResponse = await page.request.post("/api/chats", {
    data: { name: "Roleplay Background Smoke", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const backgroundUrl = "/api/backgrounds/file/rp-background-smoke.png";
  const requestedMethods: string[] = [];

  try {
    await page.route("**/api/backgrounds", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "user:rp-background-smoke.png",
            filename: "rp-background-smoke.png",
            url: backgroundUrl,
            tags: [],
            source: "user",
            createdAt: "2026-07-16T00:00:00.000Z",
            folderId: null,
          },
        ]),
      });
    });
    await page.route(`**${backgroundUrl}**`, async (route) => {
      requestedMethods.push(route.request().method());
      if (route.request().method() !== "GET") {
        await route.fulfill({ status: 405, body: "" });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" preserveAspectRatio="none"><path fill="#8f365f" d="M0 0h800v900H0z"/><path fill="#36548f" d="M800 0h800v900H800z"/></svg>',
      });
    });
    await page.addInitScript((chatId) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
    }, chat.id);
    await page.goto("/");

    await page.locator('[data-tour="panel-settings"]').click();
    await page.getByPlaceholder("Search settings").fill("Backgrounds");
    await page.getByRole("button", { name: /Backgrounds Section/ }).click();
    await page.getByRole("button", { name: "Clear selection" }).click();
    await expect
      .poll(async () =>
        page
          .locator("img.mari-background:not([src])")
          .evaluateAll(
            (layers) => layers.length > 0 && layers.every((layer) => (layer as HTMLElement).style.opacity === "0"),
          ),
      )
      .toBe(true);
    await page.getByRole("button", { name: "Browse library" }).click();
    const library = page.getByRole("dialog", { name: "Background Library" });
    await expect(library).toBeVisible();
    await library
      .locator('[data-background-id="user:rp-background-smoke.png"]')
      .getByRole("button", { name: /Use .* for this chat/u })
      .click();
    await expect(library).toBeHidden();

    await expect
      .poll(async () =>
        page
          .locator(".mari-background")
          .evaluateAll(
            (layers, expectedUrl) =>
              layers.some(
                (layer) =>
                  (layer as HTMLImageElement).getAttribute("src")?.includes(expectedUrl) &&
                  (layer as HTMLElement).style.opacity === "1",
              ),
            backgroundUrl,
          ),
      )
      .toBe(true);

    const roleplaySurface = page.locator('[data-chat-mode="roleplay"]');
    const activeBackground = page.locator(`img.mari-background[src^="${backgroundUrl}"]`);
    await expect(activeBackground).toHaveCSS("object-fit", "cover");
    const expectBackgroundToFitRoleplaySurface = async () => {
      await expect
        .poll(async () => {
          const [surfaceBox, backgroundBox] = await Promise.all([
            roleplaySurface.boundingBox(),
            activeBackground.boundingBox(),
          ]);
          if (!surfaceBox || !backgroundBox) return null;
          return {
            width: Math.round(backgroundBox.width - surfaceBox.width),
            height: Math.round(backgroundBox.height - surfaceBox.height),
          };
        })
        .toEqual({ width: 0, height: 0 });
    };

    await expectBackgroundToFitRoleplaySurface();
    await page.locator('[data-tour="panel-settings"]').click();
    await expectBackgroundToFitRoleplaySurface();
    await page.locator('[data-tour="panel-settings"]').click();
    await expectBackgroundToFitRoleplaySurface();
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await expectBackgroundToFitRoleplaySurface();
    await page.locator('[data-tour="sidebar-toggle"]').click();
    await expectBackgroundToFitRoleplaySurface();
    expect(requestedMethods).toContain("GET");
    expect(requestedMethods).not.toContain("HEAD");
  } finally {
    await bestEffortDelete(page.request, `/api/chats/${chat.id}`);
  }
});

test("Background library organization works with desktop drag and touch drag", async ({ page }, testInfo) => {
  const suffix = testInfo.project.name.includes("mobile") ? "mobile" : "desktop";
  const originalFilename = `background-folder-${suffix}.gif`;
  const uploadResponse = await page.request.post("/api/backgrounds/upload", {
    multipart: {
      file: {
        name: originalFilename,
        mimeType: "image/gif",
        buffer: Buffer.from(TRANSPARENT_GIF_BASE64, "base64"),
      },
    },
  });
  expect(uploadResponse.ok()).toBeTruthy();
  const uploaded = (await uploadResponse.json()) as { filename: string; url: string };
  // Renaming a background changes its filename, and the filename is its id and its displayed name.
  let currentFilename = uploaded.filename;
  let backgroundId = `user:${currentFilename}`;
  let folderId: string | null = null;

  try {
    const tagResponse = await page.request.patch(`/api/backgrounds/${encodeURIComponent(uploaded.filename)}/tags`, {
      data: { tags: ["smoke-folder"] },
    });
    expect(tagResponse.ok()).toBeTruthy();

    await page.goto("/");
    await page.locator('[data-tour="panel-settings"]').click();
    await page.getByRole("tab", { name: "Appearance" }).click();
    await page.getByPlaceholder("Search settings").fill("Backgrounds");
    await page.getByRole("button", { name: /Backgrounds Section/ }).click();
    await page.getByRole("button", { name: "Browse library" }).click();
    await expect(page.getByRole("dialog", { name: "Background Library" })).toBeVisible();
    await expect(page.getByRole("button", { name: /My uploads/ })).toBeVisible();
    await page.getByRole("button", { name: /My uploads/ }).click();

    const backgroundRowBeforeRename = page.locator(`[data-background-id="${backgroundId}"]:not([aria-hidden="true"])`);
    await backgroundRowBeforeRename.getByTitle("Rename background").click();
    const renameInput = backgroundRowBeforeRename.getByRole("textbox", { name: `Rename ${currentFilename}` });
    await renameInput.fill(`rainy-arcade-${suffix}`);
    const [renameResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          new URL(response.url()).pathname === `/api/backgrounds/${encodeURIComponent(currentFilename)}/rename`,
      ),
      renameInput.press("Enter"),
    ]);
    currentFilename = ((await renameResponse.json()) as { filename: string }).filename;
    backgroundId = `user:${currentFilename}`;
    expect(currentFilename).toBe(`rainy-arcade-${suffix}.gif`);
    await expect(
      page.locator(`[data-background-id="${backgroundId}"]:not([aria-hidden="true"])`).getByText(currentFilename, {
        exact: true,
      }),
    ).toBeVisible();

    const backgroundLibrary = page.getByRole("dialog", { name: "Background Library" });
    await backgroundLibrary.getByRole("button", { name: "Close Background Library" }).click();
    await expect(backgroundLibrary).toBeHidden();
    await page.getByRole("button", { name: "Browse library" }).click();
    await expect(backgroundLibrary).toBeVisible();
    await page.getByPlaceholder("Search backgrounds").fill(`rainy-arcade-${suffix}`);

    await expect(page.getByText("Drag a background onto a folder chip to file it.")).toBeVisible();
    const sortSelect = page.getByLabel("Sort backgrounds");
    await expect(sortSelect.locator("option")).toHaveText(["A-Z", "Z-A", "Newest", "Oldest"]);
    await page.getByRole("button", { name: /Tags \(/ }).click();
    await page.getByRole("button", { name: "smoke-folder", exact: true }).click();

    const backgroundRow = page.locator(`[data-background-id="${backgroundId}"]:not([aria-hidden="true"])`);
    await expect(backgroundRow).toBeVisible();
    await expect(backgroundRow.getByText(currentFilename, { exact: true })).toBeVisible();
    await page.getByPlaceholder("Search backgrounds").fill("");
    const backgroundActions = backgroundRow.locator("[data-background-actions]");
    const defaultToggle = backgroundRow.locator("[data-background-default-toggle]");
    if (testInfo.project.name.includes("mobile")) {
      await expect(backgroundActions).toHaveCSS("opacity", "1");
    } else {
      await page.getByPlaceholder("Search backgrounds").focus();
      await page.mouse.move(0, 0);
      await expect(backgroundActions).toHaveCSS("opacity", "0");
      await backgroundRow.hover();
      await expect(backgroundActions).toHaveCSS("opacity", "1");
    }
    await defaultToggle.scrollIntoViewIfNeeded();
    const starBefore = await defaultToggle.boundingBox();
    await defaultToggle.click();
    await expect(defaultToggle).toHaveAttribute("aria-pressed", "true");
    const starAfter = await defaultToggle.boundingBox();
    expect(Math.abs((starAfter?.x ?? 0) - (starBefore?.x ?? 0))).toBeLessThan(1);
    expect(Math.abs((starAfter?.y ?? 0) - (starBefore?.y ?? 0))).toBeLessThan(1);
    if (!testInfo.project.name.includes("mobile")) {
      await sortSelect.focus();
      await sortSelect.hover();
      await expect(backgroundActions).toHaveCSS("opacity", "0");
      await expect(backgroundRow.locator("[data-background-default-indicator]")).toBeVisible();
      await backgroundRow.hover();
      await expect(backgroundActions).toHaveCSS("opacity", "1");
    }
    await defaultToggle.click();

    await page.getByRole("button", { name: "New Folder" }).click();
    const newFolderPrompt = page.getByRole("dialog", { name: "New Folder" }).getByRole("textbox");
    await expect(newFolderPrompt).toBeVisible();
    const [createFolderResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" && new URL(response.url()).pathname === "/api/backgrounds/folders",
      ),
      newFolderPrompt.press("Enter"),
    ]);
    expect(createFolderResponse.ok()).toBeTruthy();
    const createdFolder = (await createFolderResponse.json()) as { id: string; name: string };
    folderId = createdFolder.id;

    const folder = page.locator(`[data-background-folder-id="${folderId}"]`);
    await expect(folder).toBeVisible();
    if (testInfo.project.name.includes("mobile")) {
      const dragHandle = backgroundRow.getByTitle(/^Drag /);
      const startRect = await dragHandle.boundingBox();
      expect(startRect).not.toBeNull();
      const start = {
        x: startRect!.x + startRect!.width / 2,
        y: startRect!.y + startRect!.height / 2,
      };
      await dragHandle.evaluate((handle, point) => {
        const touch = { identifier: 1, target: handle, clientX: point.x, clientY: point.y };
        const event = new Event("touchstart", { bubbles: true, cancelable: true });
        Object.defineProperties(event, {
          touches: { value: [touch] },
          changedTouches: { value: [touch] },
        });
        handle.dispatchEvent(event);
      }, start);
      await expect(backgroundRow).toHaveAttribute("draggable", "false");
      await page.waitForTimeout(350);
      await expect(backgroundRow).toHaveClass(/opacity-50/);
      await folder.scrollIntoViewIfNeeded();
      const targetRect = await folder.boundingBox();
      expect(targetRect).not.toBeNull();
      const end = {
        x: targetRect!.x + targetRect!.width / 2,
        y: targetRect!.y + Math.min(targetRect!.height / 2, 20),
      };
      await expect
        .poll(() =>
          page.evaluate(
            ({ point, targetFolderId }) =>
              document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>("[data-background-folder-id]")?.dataset
                .backgroundFolderId === targetFolderId,
            { point: end, targetFolderId: folderId! },
          ),
        )
        .toBe(true);
      await page.evaluate(
        ({ sourceId, point }) => {
          const source = document.querySelector<HTMLElement>(`[data-background-id="${sourceId}"]`);
          if (!source) throw new Error("Background touch drag source was not rendered");
          const touch = { identifier: 1, target: source, clientX: point.x, clientY: point.y };
          const move = new Event("touchmove", { bubbles: true, cancelable: true });
          Object.defineProperties(move, {
            touches: { value: [touch] },
            changedTouches: { value: [touch] },
          });
          window.dispatchEvent(move);
          const end = new Event("touchend", { bubbles: true, cancelable: true });
          Object.defineProperties(end, {
            touches: { value: [] },
            changedTouches: { value: [touch] },
          });
          window.dispatchEvent(end);
        },
        { sourceId: backgroundId, point: end },
      );
    } else {
      await backgroundRow.dragTo(folder);
    }

    await expect
      .poll(async () => {
        const response = await page.request.get("/api/backgrounds");
        const backgrounds = (await response.json()) as Array<{ id: string; folderId: string | null }>;
        return backgrounds.find((background) => background.id === backgroundId)?.folderId ?? null;
      })
      .toBe(folderId);

    // Dragging is pointer-only, so the same move has to be reachable from the card's action row.
    await page.locator('[data-background-folder-filter-id="all"]').click();
    await backgroundRow.locator("[data-background-move]").click();
    await page.getByRole("dialog").getByRole("button", { name: "Unfiled", exact: true }).click();
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/backgrounds");
        const backgrounds = (await response.json()) as Array<{ id: string; folderId: string | null }>;
        return backgrounds.find((background) => background.id === backgroundId)?.folderId ?? null;
      })
      .toBeNull();
    await backgroundRow.locator("[data-background-move]").click();
    await page.getByRole("dialog").getByRole("button", { name: createdFolder.name, exact: true }).click();
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/backgrounds");
        const backgrounds = (await response.json()) as Array<{ id: string; folderId: string | null }>;
        return backgrounds.find((background) => background.id === backgroundId)?.folderId ?? null;
      })
      .toBe(folderId);

    // The star is a favorite, independent of the Roleplay default set earlier in this test.
    const favoriteToggle = backgroundRow.locator("[data-background-favorite-toggle]");
    await favoriteToggle.scrollIntoViewIfNeeded();
    await favoriteToggle.click();
    await expect(favoriteToggle).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/backgrounds");
        const backgrounds = (await response.json()) as Array<{ id: string; favorite?: boolean }>;
        return backgrounds.find((background) => background.id === backgroundId)?.favorite ?? false;
      })
      .toBe(true);
    await page.locator('[data-background-folder-filter-id="favorites"]').click();
    await expect(backgroundRow).toBeVisible();

    // Rename and delete the active folder from the folder chips; its background falls back to unfiled.
    await page.locator(`[data-background-folder-filter-id="${folderId}"]`).click();
    await page.getByRole("button", { name: /^Rename folder / }).click();
    const folderNamePrompt = page.getByRole("dialog", { name: "Rename Folder" }).getByRole("textbox");
    await folderNamePrompt.fill(`Alleys ${suffix}`);
    await folderNamePrompt.press("Enter");
    await expect(page.locator(`[data-background-folder-filter-id="${folderId}"]`)).toContainText(`Alleys ${suffix}`);

    await page.getByRole("button", { name: `Delete folder Alleys ${suffix}` }).click();
    await page.getByRole("button", { name: "Delete Folder", exact: true }).click();
    await expect(page.locator(`[data-background-folder-filter-id="${folderId}"]`)).toHaveCount(0);
    await expect
      .poll(async () => {
        const response = await page.request.get("/api/backgrounds");
        const backgrounds = (await response.json()) as Array<{ id: string; folderId: string | null }>;
        return backgrounds.find((background) => background.id === backgroundId)?.folderId ?? null;
      })
      .toBeNull();
    folderId = null;
  } finally {
    if (folderId) {
      await bestEffortDelete(page.request, `/api/backgrounds/folders/${encodeURIComponent(folderId)}`);
    }
    await bestEffortDelete(page.request, `/api/backgrounds/${encodeURIComponent(currentFilename)}`);
  }
});

test("character editor preserves unsaved fields across responsive layout changes", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Responsive editor regression starts in desktop layout.");

  const characterName = `Responsive Character ${Date.now().toString(36)}`;
  const response = await request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        description: "Saved description",
      },
    },
  });
  expect(response.ok()).toBeTruthy();
  const character = (await response.json()) as { id: string };

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-characters"]').click();
    await page.locator(`[data-touch-drag-card="character"][data-character-id="${character.id}"]`).click();

    const desktopEditor = page.locator('[data-component="DetailEditor"]');
    const unsavedName = `${characterName} unsaved`;
    await desktopEditor.locator(".mari-editor-title-input").fill(unsavedName);

    await page.setViewportSize({ width: 760, height: 900 });
    const mobileEditor = page.locator('[data-component="MobileDetailSheet"]');
    await expect(mobileEditor).toBeVisible();
    await expect(mobileEditor.locator(".mari-editor-title-input")).toHaveValue(unsavedName);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(desktopEditor).toBeVisible();
    await expect(desktopEditor.locator(".mari-editor-title-input")).toHaveValue(unsavedName);
  } finally {
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("character card fields can preview Markdown without changing their source", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The shared field preview needs one desktop browser proof.");

  const characterName = `Markdown Character ${Date.now().toString(36)}`;
  const response = await request.post("/api/characters", {
    data: {
      data: {
        name: characterName,
        description: "Saved description",
      },
    },
  });
  expect(response.ok()).toBeTruthy();
  const character = (await response.json()) as { id: string };

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-characters"]').click();
    await page.locator(`[data-touch-drag-card="character"][data-character-id="${character.id}"]`).click();

    const editor = page.locator('[data-component="DetailEditor"]');
    await editor.getByRole("button", { name: "Card", exact: true }).click();
    const description = editor.locator("#character-card-description");
    const source = "**Bold detail**\n\n- First point";
    await description.locator("textarea").fill(source);
    await description.getByRole("button", { name: "Preview Markdown", exact: true }).click();

    const preview = description.getByRole("region", { name: "Markdown preview", exact: true });
    await expect(preview.locator("strong")).toHaveText("Bold detail");
    await expect(preview.locator("li")).toHaveText("First point");

    await description.getByRole("button", { name: "Edit Markdown source", exact: true }).click();
    await expect(description.locator("textarea")).toHaveValue(source);
  } finally {
    await request.delete(`/api/characters/${character.id}`).catch(() => undefined);
  }
});

test("persona editor preserves unsaved fields across responsive layout changes", async ({
  page,
  request,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "Responsive editor regression starts in desktop layout.");

  const personaName = `Responsive Persona ${Date.now().toString(36)}`;
  const response = await request.post("/api/characters/personas", {
    data: {
      name: personaName,
      description: "Saved description",
    },
  });
  expect(response.ok()).toBeTruthy();
  const persona = (await response.json()) as { id: string };

  try {
    await page.goto("/");
    await page.locator('[data-tour="panel-personas"]').click();
    await page.locator('[data-touch-drag-card="persona"]').filter({ hasText: personaName }).click();

    const desktopEditor = page.locator('[data-component="DetailEditor"]');
    const unsavedName = `${personaName} unsaved`;
    await desktopEditor.locator(".mari-editor-title-input").fill(unsavedName);

    await page.setViewportSize({ width: 760, height: 900 });
    const mobileEditor = page.locator('[data-component="MobileDetailSheet"]');
    await expect(mobileEditor).toBeVisible();
    await expect(mobileEditor.locator(".mari-editor-title-input")).toHaveValue(unsavedName);

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(desktopEditor).toBeVisible();
    await expect(desktopEditor.locator(".mari-editor-title-input")).toHaveValue(unsavedName);
  } finally {
    await request.delete(`/api/characters/personas/${persona.id}`).catch(() => undefined);
  }
});

test("image prompt review preserves edits through rerenders and submits the edited prompt", async ({
  page,
  request,
}) => {
  const chatResponse = await request.post("/api/chats", {
    data: {
      name: "Image Prompt Review Draft Smoke",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const originalPrompt = "Original illustration prompt";
  const editedPrompt = "Edited illustration prompt with deliberate composition";
  const releaseRetry = createDeferred();
  let submittedPrompt = "";

  await page.route("**/api/generate/retry-agents", async (route) => {
    const body = route.request().postDataJSON() as {
      illustratorPromptReviewOverride?: { prompt?: string };
    };
    submittedPrompt = body.illustratorPromptReviewOverride?.prompt ?? "";
    await releaseRetry.promise;
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: 'data: {"type":"done","data":null}\n\n',
    });
  });
  await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);

  try {
    await page.goto("/");
    await expect(page.getByRole("textbox", { name: /^Write/u })).toBeVisible();
    await page.evaluate(
      ({ chatId, prompt }) => {
        window.dispatchEvent(
          new CustomEvent("marinara:image-prompt-review", {
            detail: {
              chatId,
              item: {
                id: "illustration",
                kind: "illustration",
                title: "Scene illustration",
                prompt,
              },
              resultData: { shouldGenerate: true },
            },
          }),
        );
      },
      { chatId: chat.id, prompt: originalPrompt },
    );

    const dialog = page.getByRole("dialog", { name: "Review Image Prompt" });
    const promptEditor = dialog.locator("textarea").first();
    await expect(promptEditor).toHaveValue(originalPrompt);
    await promptEditor.fill(editedPrompt);

    await page.evaluate(async (chatId) => {
      const { useAgentStore } = (await import("/src/stores/agent.store.ts")) as {
        useAgentStore: {
          getState: () => {
            setProcessing: (processing: boolean, activeChatId?: string | null) => void;
          };
        };
      };
      useAgentStore.getState().setProcessing(true, chatId);
    }, chat.id);
    await expect(promptEditor).toHaveValue(editedPrompt);

    await dialog.getByRole("button", { name: "Generate", exact: true }).click();
    await expect.poll(() => submittedPrompt).toBe(editedPrompt);
    await expect(promptEditor).toHaveValue(editedPrompt);
    await expect(dialog.getByRole("button", { name: "Generate", exact: true })).toBeDisabled();

    releaseRetry.resolve();
    await expect(dialog).toBeHidden();
  } finally {
    releaseRetry.resolve();
    await request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

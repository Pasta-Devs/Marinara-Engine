import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatSettingsTool } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function seedChat(request: APIRequestContext, name: string, connectionId: string) {
  const response = await request.post("/api/chats", {
    data: { name, mode: "roleplay", characterIds: [], connectionId },
  });
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

async function openNotes(page: Page) {
  const drawer = await openChatSettingsTool(page, "author-notes");
  const input = drawer.getByRole("textbox", { name: "Author's Notes", exact: true });
  await expect(input).toBeVisible();
  return input;
}

async function switchChat(page: Page, chatId: string) {
  await page.evaluate(async (id) => {
    const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
    useChatStore.getState().setActiveChatId(id);
  }, chatId);
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        return useChatStore.getState().activeChat?.id;
      }),
    )
    .toBe(chatId);
}

async function readNotes(request: APIRequestContext, id: string) {
  const response = await request.get(`/api/chats/${id}`);
  expect(response.ok()).toBeTruthy();
  const chat = await response.json();
  const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
  return metadata.authorNotes ?? "";
}

async function prepare(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript(
    ({ id, version }) => {
      if (!localStorage.getItem("marinara-active-chat-id")) localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { id: chatId, version },
  );
  await page.goto("/");
}

test("Author's Notes saves stay ordered, remain per chat, and finish before generation", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(90000);
  const connectionResponse = await request.post("/api/connections", {
    data: {
      name: "Author notes isolation",
      provider: "custom",
      baseUrl: "http://127.0.0.1:1/v1",
      apiKey: "fixture",
      model: "notes-fixture",
      maxContext: 32768,
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = await connectionResponse.json();
  const a = await seedChat(request, "Notes A", connection.id);
  const b = await seedChat(request, "Notes B", connection.id);
  const firstHeld = deferred();
  const releaseFirst = deferred();
  const secondHeld = deferred();
  const releaseSecond = deferred();
  let saves = 0;
  let generated = false;
  let notesAtGenerate: string | undefined;
  const latest = "ONLY_CHAT_A: keep the blue experiment secret.";
  try {
    await prepare(page, a);
    await page.route(`**/api/chats/${a}/metadata`, async (route) => {
      if (route.request().method() !== "PATCH" || !Object.hasOwn(route.request().postDataJSON(), "authorNotes")) {
        return route.continue();
      }
      saves += 1;
      if (saves === 1) {
        firstHeld.resolve();
        await releaseFirst.promise;
      }
      if (saves === 2) {
        secondHeld.resolve();
        await releaseSecond.promise;
      }
      await route.fulfill({ response: await route.fetch() });
    });
    await page.route("**/api/generate", async (route) => {
      notesAtGenerate = await readNotes(request, a);
      await route.fulfill({ contentType: "text/event-stream", body: 'data: {"type":"done"}\n\n' });
      generated = true;
    });
    const notes = await openNotes(page);
    await notes.fill("OLDER_CHAT_A");
    await notes.blur();
    await firstHeld.promise;
    await notes.fill(latest);
    await notes.blur();
    // Give an incorrectly concurrent request time to reach the controlled route.
    await page.waitForTimeout(300);
    expect(saves, "A later note save must wait for the first request").toBe(1);
    // Closing Chat Settings waits for the held save. On desktop the composer sits beside the window; the
    // phone sheet covers it, so there the test closes the sheet straight away.
    if (testInfo.project.name.includes("mobile")) {
      await page.evaluate(async () => {
        const { useFloatingWindowStore } = await import("/src/stores/floating-window.store.ts" as string);
        useFloatingWindowStore.getState().closeWindow("chat-settings");
      });
    }
    await page.locator("textarea.mari-chat-input-textarea").fill("Continue the experiment.");
    await page.locator("button.mari-chat-send-btn").click();
    await page.waitForTimeout(300);
    expect(generated, "Generation must wait for pending notes").toBe(false);
    releaseFirst.resolve();
    await secondHeld.promise;
    expect(generated).toBe(false);
    // The originating editor unmounts; a blank destination must not inherit its notes.
    await switchChat(page, b);
    const otherNotes = await openNotes(page);
    await expect(otherNotes).toHaveValue("");
    await otherNotes.fill("ONLY_CHAT_B: tell the red story.");
    await otherNotes.blur();
    await expect.poll(() => readNotes(request, b)).toBe("ONLY_CHAT_B: tell the red story.");
    releaseSecond.resolve();
    await expect.poll(() => generated).toBe(true);
    expect(notesAtGenerate, "Generation read storage before notes saved").toBe(latest);
    await expect.poll(() => readNotes(request, a)).toBe(latest);
    await switchChat(page, a);
    await expect(await openNotes(page)).toHaveValue(latest);
    await page.screenshot({ path: testInfo.outputPath("notes-a-saved.png"), animations: "disabled" });
    await page.reload();
    await expect(await openNotes(page)).toHaveValue(latest);
    for (const [id, own, other] of [
      [a, "ONLY_CHAT_A", "ONLY_CHAT_B"],
      [b, "ONLY_CHAT_B", "ONLY_CHAT_A"],
    ]) {
      const response = await request.post("/api/generate/dryRun", { data: { chatId: id, returnPrompt: true } });
      expect(response.ok(), await response.text()).toBeTruthy();
      const prompt = JSON.stringify((await response.json()).prompt.messages);
      expect(prompt).toContain(own);
      expect(prompt).not.toContain(other);
    }
  } finally {
    releaseFirst.resolve();
    releaseSecond.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await request.delete(`/api/chats/${a}`);
    await request.delete(`/api/chats/${b}`);
    await request.delete(`/api/connections/${connection.id}`);
  }
});

test("Author's Notes preserves a newer draft when an earlier save fails", async ({ page, request }, testInfo) => {
  const chatId = await seedChat(request, "Notes failure", "fixture-connection");
  const held = deferred();
  const release = deferred();
  let failed = false;
  try {
    await prepare(page, chatId);
    await page.route(`**/api/chats/${chatId}/metadata`, async (route) => {
      if (!failed && route.request().method() === "PATCH") {
        failed = true;
        held.resolve();
        await release.promise;
        return route.fulfill({ status: 500, json: { error: "fixture save failure" } });
      }
      await route.continue();
    });
    const notes = await openNotes(page);
    await notes.fill("Earlier edit");
    await notes.blur();
    await held.promise;
    await notes.fill("Newer draft must survive");
    const rejected = page.waitForResponse(
      (response) => response.url().endsWith(`/chats/${chatId}/metadata`) && response.status() === 500,
    );
    release.resolve();
    await rejected;
    await page.waitForTimeout(300);
    await expect(notes).toHaveValue("Newer draft must survive");
    await page.screenshot({ path: testInfo.outputPath("notes-draft-after-failed-save.png"), animations: "disabled" });
    await notes.blur();
    await expect.poll(() => readNotes(request, chatId)).toBe("Newer draft must survive");
  } finally {
    release.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await request.delete(`/api/chats/${chatId}`);
  }
});

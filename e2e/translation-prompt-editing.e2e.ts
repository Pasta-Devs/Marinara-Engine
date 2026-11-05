import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DEFAULT_TRANSLATION_SYSTEM_PROMPT } from "../packages/shared/src/constants/defaults.js";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Translation prompt drafts keep the caret, clear normally, and save to their own chat", async ({
  page,
  request,
}, info) => {
  const chatIds: string[] = [];
  const writes: { id: string; body: Record<string, unknown> }[] = [];
  const paidRequests: string[] = [];
  let releaseEarlierSave: (() => void) | undefined;
  const readMetadata = async (id: string) => {
    const chat = await (await request.get(`/api/chats/${id}`)).json();
    return typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
  };
  const createChat = async (name: string) => {
    const response = await request.post("/api/chats", { data: { name, mode: "roleplay", characterIds: [] } });
    expect(response.ok()).toBeTruthy();
    const chat = await response.json();
    chatIds.push(chat.id);
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            translationProvider: "ai",
            enableAgents: false,
            translationInputPrompt: `${name} outgoing beginning and ending.`,
            translationOutputPrompt: `${name} incoming beginning and ending.`,
          },
        })
      ).ok(),
    ).toBeTruthy();
    return chat;
  };
  try {
    const first = await createChat("First translator");
    const second = await createChat("Second translator");
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.route("**/api/chats/*/metadata", async (route) => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        if (Object.keys(body).some((key) => key === "translationInputPrompt" || key === "translationOutputPrompt")) {
          writes.push({ id: new URL(route.request().url()).pathname.split("/").at(-2)!, body });
        }
      }
      await route.continue();
    });
    page.on("request", (request) => {
      if (request.method() === "POST" && /\/api\/(?:generate|translate)(?:[/?]|$)/u.test(request.url()))
        paidRequests.push(request.url());
    });
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chibiProfessorMariEnabled: false,
      trackerPanelEnabled: false,
      appAccentPulseMode: false,
      chatHelpSeenModes: ["roleplay"],
      chatSettingsExpandedSections: { translation: true },
      theme: info.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: first.id, version },
    );
    await page.goto("/");
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    const openSettings = async () => {
      await page.evaluate(async () => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        useChatStore.getState().setShouldOpenSettings(true);
      });
    };
    await openSettings();
    const drawer = page.locator(".mari-chat-settings-drawer");
    const section = drawer.locator('[data-chat-settings-section="translation"]');
    await expect(section).toBeVisible();
    const prompts = section.locator("textarea");
    const fields = [
      {
        field: prompts.nth(0),
        key: "translationInputPrompt",
        replacement: "Outgoing custom {{targetLanguage}} prompt.",
      },
      {
        field: prompts.nth(1),
        key: "translationOutputPrompt",
        replacement: "Incoming custom {{targetLanguage}} prompt.",
      },
    ];
    for (const { field, key, replacement } of fields) {
      const original = await field.inputValue();
      const tokenEstimate = field.locator("..").locator("p");
      const originalEstimate = await tokenEstimate.innerText();
      await field.focus();
      await field.evaluate((element) => (element as HTMLTextAreaElement).setSelectionRange(6, 6));
      await field.pressSequentially("XY");
      await expect(field).toHaveValue(`${original.slice(0, 6)}XY${original.slice(6)}`);
      expect(await field.evaluate((element) => (element as HTMLTextAreaElement).selectionStart)).toBe(8);
      await field.fill("");
      await expect(field).toHaveValue("");
      await expect(tokenEstimate).toHaveText("~0 tokens");
      await expect(field).toBeFocused();
      await field.pressSequentially(replacement);
      await expect(field).toHaveValue(replacement);
      await field.fill(`${replacement} ${"Additional context for translation. ".repeat(30)}`);
      await expect(tokenEstimate).not.toHaveText(originalEstimate);
      await expect(field).toBeFocused();
      await field.fill(replacement);
      expect(writes.filter((write) => Object.hasOwn(write.body, key))).toHaveLength(0);
      await section.getByRole("combobox").first().focus();
      await expect.poll(async () => (await readMetadata(first.id))[key]).toBe(replacement);
      expect(writes.filter((write) => Object.hasOwn(write.body, key))).toHaveLength(1);
    }
    await prompts.nth(1).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("translation-prompts-edited.png") });

    let earlierSaveHeld = false;
    const earlierSaveGate = new Promise<void>((resolve) => (releaseEarlierSave = resolve));
    await page.route(`**/api/chats/${first.id}/metadata`, async (route) => {
      if (route.request().method() === "PATCH" && Object.hasOwn(route.request().postDataJSON(), "autoTranslate")) {
        earlierSaveHeld = true;
        await earlierSaveGate;
      }
      await route.fallback();
    });
    await section.getByText("Auto-Translate Responses", { exact: true }).click();
    await expect(section.getByRole("checkbox", { name: /^Auto-Translate Responses/ })).toBeChecked();
    await expect.poll(() => earlierSaveHeld).toBe(true);
    const pendingPrompt = "Keep this prompt while its earlier save is held.";
    await prompts.nth(0).fill(pendingPrompt);
    await section.getByRole("combobox").first().focus();
    await expect(prompts.nth(0)).toHaveValue(pendingPrompt);
    await prompts.nth(0).focus();
    await section.getByRole("combobox").first().focus();
    await expect(prompts.nth(0)).toHaveValue(pendingPrompt);
    const latestPendingPrompt = "The second queued prompt must remain current too.";
    await prompts.nth(0).fill(latestPendingPrompt);
    await section.getByRole("combobox").first().focus();
    await expect(prompts.nth(0)).toHaveValue(latestPendingPrompt);
    await prompts.nth(0).focus();
    await section.getByRole("combobox").first().focus();
    releaseEarlierSave!();
    await expect.poll(async () => (await readMetadata(first.id)).translationInputPrompt).toBe(latestPendingPrompt);
    await expect(prompts.nth(0)).toHaveValue(latestPendingPrompt);

    // Changing the active chat without a blur exercises the existing unmount flush and keyed ownership.
    await prompts.nth(0).fill("First chat has an unblurred draft.");
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, second.id);
    await expect(prompts.nth(0)).toHaveValue("Second translator outgoing beginning and ending.");
    await expect
      .poll(async () => (await readMetadata(first.id)).translationInputPrompt)
      .toBe("First chat has an unblurred draft.");
    expect((await readMetadata(second.id)).translationInputPrompt).toBe(
      "Second translator outgoing beginning and ending.",
    );

    // Synthetic composition events plus native text insertion; physical OS IME calibration remains manual.
    const incoming = prompts.nth(1);
    await incoming.fill("");
    await incoming.dispatchEvent("compositionstart", { data: "" });
    await page.keyboard.insertText("日本語の翻訳 {{targetLanguage}} 🧪");
    await expect(incoming).toHaveValue("日本語の翻訳 {{targetLanguage}} 🧪");
    await incoming.dispatchEvent("compositionend", { data: "日本語の翻訳" });
    expect(writes.filter((write) => write.id === second.id)).toHaveLength(0);
    await drawer.getByRole("button", { name: /^Close chat settings$/i }).click();
    await expect(drawer).toHaveCount(0);
    await expect
      .poll(async () => (await readMetadata(second.id)).translationOutputPrompt)
      .toBe("日本語の翻訳 {{targetLanguage}} 🧪");
    expect((await readMetadata(first.id)).translationOutputPrompt).toBe(fields[1]!.replacement);

    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setActiveChatId(id);
    }, first.id);
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await openSettings();
    await expect(prompts.nth(0)).toHaveValue("First chat has an unblurred draft.");
    await expect(prompts.nth(1)).toHaveValue(fields[1]!.replacement);
    await prompts.nth(1).fill("");
    await expect(prompts.nth(1)).toHaveValue("");
    await section.getByRole("combobox").first().focus();
    await expect.poll(async () => (await readMetadata(first.id)).translationOutputPrompt).toBe(null);
    await expect(prompts.nth(1)).toHaveValue(DEFAULT_TRANSLATION_SYSTEM_PROMPT);
    await page.reload();
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await openSettings();
    await expect(prompts.nth(0)).toHaveValue("First chat has an unblurred draft.");
    await expect(prompts.nth(1)).toHaveValue(DEFAULT_TRANSLATION_SYSTEM_PROMPT);
    await section.getByRole("button", { name: "Restore", exact: true }).first().click();
    await expect.poll(async () => (await readMetadata(first.id)).translationInputPrompt).toBe(null);
    await expect(prompts.nth(0)).toHaveValue(DEFAULT_TRANSLATION_SYSTEM_PROMPT);
    expect(paidRequests).toEqual([]);
  } finally {
    releaseEarlierSave?.();
    await page.close();
    for (const id of chatIds) await request.delete(`/api/chats/${id}?force=true`).catch(() => undefined);
  }
});

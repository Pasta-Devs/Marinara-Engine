import { expect, test, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const mode of ["roleplay", "conversation"] as const) {
  test(`${mode} guided regeneration keeps its guidance unless the setting clears it`, async ({ page, request }, testInfo) => {
    const chatIds: string[] = [];
    let connectionId: string | undefined;
    let pending: Route | undefined;
    let requests = 0;
    try {
      const connection = await request.post("/api/connections", {
        data: {
          name: "Guided regeneration",
          provider: "custom",
          baseUrl: "http://127.0.0.1:1/v1",
          apiKey: "fixture",
          model: "guided-fixture",
          maxContext: 32768,
        },
      });
      expect(connection.ok(), await connection.text()).toBeTruthy();
      connectionId = (await connection.json()).id as string;
      for (const name of ["Guided regeneration", "Other draft"]) {
        const response = await request.post("/api/chats", { data: { name, mode, characterIds: [], connectionId } });
        expect(response.ok(), await response.text()).toBeTruthy();
        chatIds.push((await response.json()).id);
      }
      const chatId = chatIds[0]!;
      const saved = await request.post(`/api/chats/${chatId}/messages`, {
        data: { role: "assistant", content: "An original response awaiting a new direction." },
      });
      expect(saved.ok()).toBeTruthy();
      const message = await saved.json();
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await page.route("**/api/generate", (route) => {
        pending = route;
        requests += 1;
      });
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        guideGenerations: true,
        intuitiveSwipeNavigation: true,
        intuitiveSwipeRerollLatest: true,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        enableStreaming: false,
      });
      await page.addInitScript(
        ({ chatId, version }) => {
          localStorage.setItem("marinara-active-chat-id", chatId);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { chatId, version },
      );
      await page.goto("/");
      await page.getByRole("button", { name: "Chats", exact: true }).click();
      const mobile = testInfo.project.name.includes("mobile");
      if (mobile) await page.getByRole("button", { name: "Close chats", exact: true }).click();
      const composer = page.locator("textarea[data-chat-composer]");
      const row = page.locator(`[data-message-id="${message.id}"]`);
      const confirm = page.getByRole("dialog", { name: "Regenerate Message", exact: true });
      const send =
        mode === "roleplay"
          ? page.locator("button.mari-chat-send-btn")
          : page.getByRole("button", { name: "Send", exact: true });
      const regenerate = async () => {
        await row.focus();
        await row.getByRole("button", { name: "Regenerate (guided)", exact: true }).click();
        if (mobile) await confirm.getByRole("button", { name: "Regenerate", exact: true }).click();
      };
      const expectGuidedRequest = async (count: number, guidance: string) => {
        await expect.poll(() => requests).toBe(count);
        expect(pending!.request().postDataJSON()).toMatchObject({
          chatId,
          regenerateMessageId: message.id,
          generationGuideSource: "guide",
          generationGuide: expect.stringContaining(guidance),
        });
      };
      const storedDraft = () =>
        page.evaluate(async (id) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          return useChatStore.getState().inputDrafts.get(id) ?? "";
        }, chatId);
      const settled = () =>
        expect
          .poll(() =>
            page.evaluate(async (id) => {
              const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
              return useChatStore.getState().abortControllers.has(id);
            }, chatId),
          )
          .toBe(false);
      const fail = async () => {
        const route = pending!;
        pending = undefined;
        await route.fulfill({ status: 503, json: { error: "Synthetic guided regeneration failure." } });
        await settled();
      };
      const succeed = async () => {
        const route = pending!;
        pending = undefined;
        await route.fulfill({
          contentType: "text/event-stream",
          body: [
            { type: "token", data: message.content },
            { type: "message_saved", data: message },
            { type: "done", data: {} },
          ]
            .map((event) => `data: ${JSON.stringify(event)}\n\n`)
            .join(""),
        });
        await settled();
      };
      const switchChat = async (id: string) => {
        await page.evaluate(async (chatId) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setActiveChatId(chatId);
        }, id);
        await expect(composer).toHaveAttribute("data-chat-id", id);
      };

      const guidance = "  Let the lantern flicker.  ";
      await composer.fill(guidance);
      if (mobile) {
        await row.focus();
        await row.getByRole("button", { name: "Regenerate (guided)", exact: true }).click();
        await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(composer).toHaveValue(guidance);
        expect(requests).toBe(0);
      }
      await page.screenshot({ path: testInfo.outputPath("guidance-before.png") });

      // A guided regeneration sends the guidance and leaves it in the composer and its saved draft.
      await regenerate();
      await expectGuidedRequest(1, "Let the lantern flicker.");
      await expect(composer).toHaveValue(guidance);
      await succeed();
      await expect(composer).toHaveValue(guidance);
      await expect.poll(storedDraft).toBe(guidance);
      await page.screenshot({ path: testInfo.outputPath("guidance-kept.png") });

      // The kept guidance can be edited and used again; a failed attempt keeps it too.
      const edited = "Let the lantern go out.";
      await composer.fill(edited);
      await regenerate();
      await expectGuidedRequest(2, edited);
      await expect(composer).toHaveValue(edited);
      await fail();
      await expect(composer).toHaveValue(edited);

      // Rerolling the latest swipe with the arrow key uses the same guidance and keeps it.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press("ArrowRight");
      await expectGuidedRequest(3, edited);
      await succeed();
      await expect(composer).toHaveValue(edited);

      // A background regeneration leaves the other chat's draft alone and the guidance survives reload.
      await regenerate();
      await expectGuidedRequest(4, edited);
      await switchChat(chatIds[1]!);
      await composer.fill("Keep the other chat's draft.");
      await succeed();
      await expect(composer).toHaveValue("Keep the other chat's draft.");
      await switchChat(chatId);
      await expect(composer).toHaveValue(edited);
      await page.reload();
      await expect(composer).toHaveValue(edited);
      await expect.poll(storedDraft).toBe(edited);

      // Turning guidance off means regeneration must not touch the composer.
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setGuideGenerations(false);
        useUIStore.getState().setTheme("light");
      });
      await composer.fill("An unrelated normal draft.");
      await row.focus();
      await row.getByRole("button", { name: "Regenerate", exact: true }).click();
      if (mobile) await confirm.getByRole("button", { name: "Regenerate", exact: true }).click();
      await expect.poll(() => requests).toBe(5);
      expect(pending!.request().postDataJSON().generationGuide).toBeUndefined();
      await expect(composer).toHaveValue("An unrelated normal draft.");
      await succeed();
      await expect(composer).toHaveValue("An unrelated normal draft.");
      await page.screenshot({ path: testInfo.outputPath("normal-draft-preserved-light.png") });

      // A normal send still clears what it sends.
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setGuideGenerations(true);
      });
      await composer.fill("A normal reply.");
      await send.click();
      await expect.poll(() => requests).toBe(6);
      expect(pending!.request().postDataJSON()).toMatchObject({ chatId, userMessage: "A normal reply." });
      await expect(composer).toHaveValue("");
      await succeed();
      await expect(composer).toHaveValue("");
      await expect.poll(storedDraft).toBe("");

      if (mobile) {
        // A confirmation that outlives its chat must not regenerate with another chat's draft.
        await composer.fill("Guidance for this chat.");
        await row.focus();
        await row.getByRole("button", { name: "Regenerate (guided)", exact: true }).click();
        await switchChat(chatIds[1]!);
        await confirm.getByRole("button", { name: "Regenerate", exact: true }).click();
        await expect(confirm).toBeHidden();
        await expect(composer).toHaveValue("Keep the other chat's draft.");
        expect(requests).toBe(6);
      }

      // With Keep guidance after regenerating off, guided regeneration consumes its guidance (#6815).
      await clickTopbarPanel(page, "settings");
      await page.getByPlaceholder("Search settings").fill("keep guidance");
      await page
        .locator(".mari-settings-search-header button")
        .filter({ hasText: "Keep guidance after regenerating" })
        .first()
        .click();
      const keepGuidance = page.getByRole("checkbox", { name: "Keep guidance after regenerating", exact: true });
      await expect(keepGuidance).toBeChecked();
      await page
        .locator("#settings-control-keep-guidance-after-regenerating")
        .getByText("Keep guidance after regenerating", { exact: true })
        .click();
      await expect(keepGuidance).not.toBeChecked();
      await page.screenshot({ path: testInfo.outputPath("keep-guidance-setting-off.png") });
      await clickTopbarPanel(page, "settings");
      await switchChat(chatId);

      // The guidance is cleared while the attempt runs and restored after a failure.
      await composer.fill(guidance);
      await regenerate();
      await expectGuidedRequest(7, "Let the lantern flicker.");
      await expect(composer).toHaveValue("");
      await page.screenshot({ path: testInfo.outputPath("guidance-consumed.png") });
      await fail();
      await expect(composer).toHaveValue(guidance);
      await expect.poll(storedDraft).toBe(guidance);

      // A successful attempt leaves the guidance and its saved draft cleared.
      await regenerate();
      await expectGuidedRequest(8, "Let the lantern flicker.");
      await expect(composer).toHaveValue("");
      await succeed();
      await expect(composer).toHaveValue("");
      await expect.poll(storedDraft).toBe("");

      // Late success and failure must leave a draft typed after the click intact.
      for (const [index, finish] of [succeed, fail].entries()) {
        await composer.fill(edited);
        await regenerate();
        await expectGuidedRequest(9 + index, edited);
        await expect(composer).toHaveValue("");
        await composer.fill(`My next reply ${index}.`);
        await row.focus();
        await row.getByRole("button", { name: "Regenerate (guided)", exact: true }).click();
        await expect(confirm).toBeHidden();
        await expect(composer).toHaveValue(`My next reply ${index}.`);
        expect(requests).toBe(9 + index);
        await finish();
        await expect(composer).toHaveValue(`My next reply ${index}.`);
        await expect.poll(storedDraft).toBe(`My next reply ${index}.`);
      }

      // A failed background attempt restores only the originating chat's empty draft.
      await composer.fill(edited);
      await regenerate();
      await expectGuidedRequest(11, edited);
      await expect(composer).toHaveValue("");
      await switchChat(chatIds[1]!);
      await composer.fill("Keep the other chat's draft.");
      await fail();
      await expect(composer).toHaveValue("Keep the other chat's draft.");
      await switchChat(chatId);
      await expect(composer).toHaveValue(edited);
    } finally {
      if (pending) await pending.abort().catch(() => {});
      await page.close();
      for (const chatId of chatIds) {
        const removed = await request.delete(`/api/chats/${chatId}`);
        expect(removed.ok(), await removed.text()).toBeTruthy();
      }
      if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    }
  });
}

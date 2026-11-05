import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

for (const mode of ["roleplay", "conversation"] as const) {
  test(`${mode} prompt Find searches full saved and preview content without changing it`, async ({
    page,
    request,
  }, info) => {
    const characterResponse = await request.post("/api/characters", {
      data: { data: { name: "Prompt Find Fixture", first_mes: "" } },
    });
    expect(characterResponse.ok()).toBeTruthy();
    const character = await characterResponse.json();
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Prompt Find", mode, characterIds: [character.id], connectionId: "synthetic-prompt-find" },
    });
    expect(chatResponse.ok()).toBeTruthy();
    const chat = await chatResponse.json();
    try {
      const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "The notebook is ready.", characterId: character.id },
      });
      expect(messageResponse.ok()).toBeTruthy();
      const message = await messageResponse.json();
      const messages = [
        {
          role: "system",
          content: ` \n<system_prompt>\nFIND_TARGET at the start.\n${"Ordinary prompt content with no search marker, kept in full.\n".repeat(1800)}[a+b].*? <script>private text</script> Żółć İSTANBUL かな 한글\n</system_prompt>\n\n<chat_history>\n`,
        },
        { role: "user", content: "\tA Find_Target in the middle.\nKeep the notebook safe.\n" },
        { role: "assistant", content: "A final find_target at the end.\n</chat_history>\n " },
      ];
      const copied = messages.map(({ role, content }) => `[${role}]\n${content}`).join("\n\n");
      let peekRequests = 0;
      await page.route(`**/api/chats/${chat.id}/peek-prompt`, (route) => {
        peekRequests++;
        expect(route.request().postDataJSON()).toEqual(peekRequests === 1 ? { messageId: message.id } : {});
        return route.fulfill({
          json: {
            messages,
            parameters: {},
            chatMode: mode,
            exact: peekRequests === 1,
            source: peekRequests === 1 ? "cached" : "live_preview",
          },
        });
      });
      await isolateSyncedUISettings(page);
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["roleplay", "conversation"],
        appAccentPulseMode: false,
        enterToSendRP: true,
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
          let text = "";
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
              writeText: async (value: string) => {
                text = value;
              },
              readText: async () => text,
            },
          });
        },
        { id: chat.id, version },
      );
      await page.goto("/");
      const row = page.locator(`[data-message-id="${message.id}"]`).first();
      if (info.project.name.includes("mobile")) await row.getByText("The notebook is ready.", { exact: true }).tap();
      else await row.hover();
      await row.getByRole("button", { name: "Peek prompt", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Assembled Prompt", exact: true })).toBeVisible();
      await page.screenshot({ path: info.outputPath(`${mode}-initial.png`), animations: "disabled" });
      const viewer = page.getByRole("dialog", { name: "Assembled Prompt", exact: true });
      const find = viewer.getByRole("searchbox", { name: "Find in prompt", exact: true });
      await expect(find).toBeVisible();
      await expect(find).not.toBeFocused();
      const previous = viewer.getByRole("button", { name: "Previous match (Shift+Enter)", exact: true });
      const next = viewer.getByRole("button", { name: "Next match (Enter)", exact: true });
      await expect(previous).toBeDisabled();
      await expect(next).toBeDisabled();

      await viewer.focus();
      await page.keyboard.press("Shift+Tab");
      await expect(viewer.getByRole("button").last()).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(viewer.getByRole("button", { name: "Copy assembled prompt", exact: true })).toBeFocused();

      // The viewer owns shortcuts even before an input is focused; the underlying chat does not.
      for (const shortcut of ["Control+f", "Meta+f"]) {
        await viewer.focus();
        await page.keyboard.press(shortcut);
        await expect(find).toBeFocused();
      }
      // Layout events keep the typed Latin letter authoritative, with a physical-key fallback for other alphabets.
      for (const target of [viewer, find, viewer.getByRole("button").last()]) {
        for (const modifiers of [{ ctrlKey: true }, { metaKey: true }]) {
          for (const { key, code, altKey, captured } of [
            { key: "u", code: "KeyF", altKey: false, captured: false },
            { key: "а", code: "KeyF", altKey: true, captured: false },
            { key: "f", code: "KeyU", altKey: false, captured: true },
            { key: "а", code: "KeyF", altKey: false, captured: true },
          ]) {
            await target.focus();
            const prevented = await target.evaluate(
              (node, init) => {
                const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
                node.dispatchEvent(event);
                return event.defaultPrevented;
              },
              { key, code, altKey, ...modifiers },
            );
            expect(prevented, `${JSON.stringify(modifiers)} ${key}/${code} alt=${altKey}`).toBe(captured);
            if (captured) await expect(find).toBeFocused();
            else await expect(target).toBeFocused();
          }
        }
      }
      await find.fill("find_target");
      await expect(viewer.getByRole("status")).toHaveText("1 of 3");
      await expect(viewer.locator("mark[data-prompt-match]")).toHaveCount(3);
      await expect(viewer.locator('[data-prompt-match="0"][data-active="true"]')).toBeInViewport();
      await expect(viewer.locator("[data-prompt-search-message]")).toHaveText(
        messages.map(({ content }) => content),
        { useInnerText: false },
      );
      expect(await viewer.locator("[data-prompt-search-message]").allTextContents()).toEqual(
        messages.map(({ content }) => content),
      );
      await find.press("Enter");
      await expect(viewer.getByRole("status")).toHaveText("2 of 3");
      await next.click();
      await expect(viewer.getByRole("status")).toHaveText("3 of 3");
      await expect(viewer.locator('[data-prompt-match="2"][data-active="true"]')).toBeInViewport();
      await next.click();
      await expect(viewer.getByRole("status")).toHaveText("1 of 3");
      await find.press("Shift+Enter");
      await expect(viewer.getByRole("status")).toHaveText("3 of 3");
      await previous.click();
      await expect(viewer.getByRole("status")).toHaveText("2 of 3");
      await viewer.getByRole("button", { name: "Copy assembled prompt", exact: true }).click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(copied);
      await page.getByRole("button", { name: "Close toast", exact: true }).click();
      await find.fill("[a+b].*?");
      await expect(viewer.getByRole("status")).toHaveText("1 of 1");
      await expect(viewer.locator("mark")).toHaveText("[a+b].*?");
      // Lowercasing the whole source before slicing would move offsets after İ.
      await find.fill("かな 한글");
      await expect(viewer.locator("mark")).toHaveText("かな 한글");
      await find.fill("żółć");
      await expect(viewer.locator("mark")).toHaveText("Żółć");
      await find.fill("<chat_history>");
      await expect(viewer.getByRole("status")).toHaveText("1 of 1");
      await expect(viewer.locator("mark")).toHaveText("<chat_history>");
      await find.fill("e");
      const manyMatches =
        messages
          .map(({ content }) => content)
          .join("")
          .toLowerCase()
          .split("e").length - 1;
      expect(manyMatches).toBeGreaterThan(7000);
      await expect(viewer.locator("mark")).toHaveCount(manyMatches);
      await expect(viewer.getByRole("status")).toHaveText(`1 of ${manyMatches}`);
      await find.fill("not-in-this-prompt");
      await expect(viewer.getByRole("status")).toHaveText("No matches");
      await expect(viewer.locator("mark")).toHaveCount(0);
      await expect(next).toBeDisabled();
      await expect(previous).toBeDisabled();
      expect(await viewer.locator("[data-prompt-search-message]").allTextContents()).toEqual(
        messages.map(({ content }) => content),
      );
      await find.fill("find_target");
      await expect(viewer.getByRole("status")).toHaveText("1 of 3");
      for (const theme of ["light", "dark"] as const) {
        await page.evaluate(async (theme) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
        }, theme);
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await page.screenshot({ path: info.outputPath(`${mode}-${theme}-find.png`), animations: "disabled" });
      }
      await find.fill("");
      await expect(viewer.locator("[data-prompt-search-message]")).toHaveCount(0);
      await expect(viewer.getByRole("button", { name: /Chat History/ })).toBeVisible();
      await viewer.getByRole("button", { name: "Copy assembled prompt", exact: true }).click();
      await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(copied);
      await viewer.getByRole("button", { name: "Close assembled prompt", exact: true }).click();
      await expect(viewer).toHaveCount(0);
      const composer = page.locator("textarea[data-chat-composer]").first();
      await composer.fill("{{prompt}}");
      await composer.press("Enter");
      await expect(viewer).toBeVisible();
      await expect(viewer.getByText("Live Preview", { exact: true })).toBeVisible();
      await expect(find).toHaveValue("");
      await find.fill("find_target");
      await expect(viewer.getByRole("status")).toHaveText("1 of 3");
      expect(peekRequests).toBe(2);
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
      await request.delete(`/api/characters/${character.id}`);
    }
  });
}

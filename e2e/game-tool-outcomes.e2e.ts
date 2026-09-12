import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const mode of ["game", "roleplay", "conversation"] as const) {
  test(`${mode} shows refused tool results with debug disabled`, async ({ page, request }, testInfo) => {
    page.setDefaultTimeout(10_000);
    let characterId: string | undefined;
    let chatId: string | undefined;
    try {
      if (mode === "conversation") {
        const character = await request.post("/api/characters", { data: { data: { name: "Tool fixture" } } });
        expect(character.ok()).toBeTruthy();
        characterId = (await character.json()).id;
      }
      const response = await request.post("/api/chats", {
        data: {
          name: "Tool refusal proof",
          mode,
          characterIds: characterId ? [characterId] : [],
          connectionId: "synthetic-tool-fixture",
        },
      });
      expect(response.ok()).toBeTruthy();
      const { id } = await response.json();
      chatId = id;
      await request.patch(`/api/chats/${id}/metadata`, {
        data: {
          enableAgents: false,
          ...(mode === "game" ? { gameId: id, gameSessionStatus: "active", gameIntroPresented: true } : {}),
        },
      });
      if (mode === "game") {
        await request.post(`/api/chats/${id}/messages`, {
          data: { role: "assistant", content: "The party waits at the square." },
        });
      }
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["game", "roleplay", "conversation"],
        gameInstantTextReveal: true,
        debugMode: false,
        theme: "dark",
      });
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      const refused = {
        type: "tool_result",
        data: {
          name: "update_game_state",
          success: false,
          result: JSON.stringify({ error: "The location field is locked. Unlock it before changing it." }),
        },
      };
      await page.route("**/api/generate", (route) =>
        route.fulfill({
          contentType: "text/event-stream",
          body: [refused, refused, { type: "done", data: {} }]
            .map((event) => `data: ${JSON.stringify(event)}\n\n`)
            .join(""),
        }),
      );
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id, version },
      );
      await page.goto("/");
      if (mode === "game") {
        await page.getByPlaceholder("What do you do?", { exact: true }).fill("Go to the harbor.");
        await page.getByRole("button", { name: "Send game turn", exact: true }).click();
      } else if (mode === "conversation") {
        await page.getByRole("textbox", { name: /^Message/ }).fill("Go to the harbor.");
        await page.getByRole("button", { name: "Send", exact: true }).click();
      } else {
        await page.locator("textarea.mari-chat-input-textarea").fill("Go to the harbor.");
        await page.locator("button.mari-chat-send-btn").click();
      }
      const toast = page
        .locator('[data-sonner-toast][data-type="error"]')
        .filter({ hasText: "update_game_state could not run:" });
      await expect(toast).toHaveCount(1);
      await expect(toast).toContainText("The location field is locked. Unlock it before changing it.");
      await expect(toast).not.toContainText('{"error"');
      for (const theme of ["dark", "light"] as const) {
        await page.evaluate(async (theme) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setTheme(theme);
        }, theme);
        await testInfo.attach(`tool-refusal-${mode}-${theme}-${testInfo.project.name}.png`, {
          body: await page.screenshot({
            animations: "disabled",
            path: testInfo.outputPath(`tool-refusal-${mode}-${theme}.png`),
          }),
          contentType: "image/png",
        });
      }
    } finally {
      await Promise.all([
        ...(chatId ? [request.delete(`/api/chats/${chatId}`)] : []),
        ...(characterId ? [request.delete(`/api/characters/${characterId}`)] : []),
      ]);
    }
  });
}

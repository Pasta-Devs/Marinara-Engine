import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// This test exercises inventory persistence, not the settings toolbar slide.
// Its clipped controls can have stable boxes before the opening animation ends.
test.use({ reducedMotion: "reduce" });

for (const theme of ["light", "dark"] as const) {
  test(`Inventory descriptions and locations persist with item locks (${theme})`, async ({
    page,
    request,
  }, testInfo) => {
    const created = await request.post("/api/chats", {
      data: { name: "Detailed inventory fixture", mode: "roleplay", characterIds: [] },
    });
    expect(created.ok()).toBeTruthy();
    const chat = await created.json();
    try {
      expect(
        (
          await request.post(`/api/chats/${chat.id}/messages`, {
            data: { role: "assistant", content: "The tablets and key are safely packed." },
          })
        ).ok(),
      ).toBeTruthy();
      expect(
        (
          await request.patch(`/api/chats/${chat.id}/metadata`, {
            data: { enableAgents: true, activeAgentIds: ["inventory-tracker"] },
          })
        ).ok(),
      ).toBeTruthy();
      expect(
        (
          await request.patch(`/api/chats/${chat.id}/game-state`, {
            data: {
              manual: true,
              playerStats: {
                stats: [],
                attributes: null,
                skills: {},
                inventory: [],
                activeQuests: [],
                status: "",
                inventoryTrackerInventory: [
                  { name: "Painkillers", qty: 3, description: "Small white tablets", location: "Backpack side pocket" },
                  { name: "Brass key" },
                ],
              },
            },
          })
        ).ok(),
      ).toBeTruthy();
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        sidebarOpen: false,
        rightPanelOpen: false,
        trackerPanelEnabled: true,
        trackerPanelOpen: true,
        trackerPanelOpenByChatId: { [chat.id]: true },
        theme,
        appAccentPulseMode: false,
      });
      await page.addInitScript(
        ({ chatId, version }) => {
          localStorage.setItem("marinara-active-chat-id", chatId);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { chatId: chat.id, version },
      );
      await page.goto("/");
      const state = async () => (await request.get(`/api/chats/${chat.id}/game-state`)).json();
      const items = async () => (await state()).playerStats.inventoryTrackerInventory;
      const location = page.getByRole("button", { name: "Location for Painkillers", exact: true });
      const description = page.getByRole("button", { name: "Description for Painkillers", exact: true });
      await expect(location).toHaveText("Backpack side pocket");
      await expect(description).toHaveText("Small white tablets");
      await location.click();
      const locationInput = page.getByRole("textbox", { name: "Location for Painkillers", exact: true });
      await locationInput.fill("Bedside table");
      await locationInput.press("Enter");
      await expect.poll(async () => (await items())[0].location).toBe("Bedside table");
      await page.getByTitle("Quantity for Painkillers", { exact: true }).fill("1");
      await page.getByTitle("Quantity for Painkillers", { exact: true }).press("Enter");
      await expect
        .poll(items)
        .toEqual([
          { name: "Painkillers", description: "Small white tablets", location: "Bedside table" },
          { name: "Brass key" },
        ]);
      await page.getByRole("button", { name: "Open tracker settings", exact: true }).click();
      await page.getByRole("button", { name: "Enter tracker add mode", exact: true }).click();
      await expect(page.getByRole("button", { name: "Exit tracker add mode", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.getByRole("button", { name: "Description for Brass key", exact: true }).click();
      const keyDescription = page.getByRole("textbox", { name: "Description for Brass key", exact: true });
      await keyDescription.fill("Marked with the number 17");
      await keyDescription.press("Enter");
      await expect.poll(async () => (await items())[1].description).toBe("Marked with the number 17");
      await page.getByRole("button", { name: "Enter tracker lock mode", exact: true }).click();
      await expect(page.getByRole("button", { name: "Exit tracker lock mode", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.getByRole("button", { name: /^Lock.*Location for Painkillers/ }).click();
      await expect
        .poll(async () =>
          Object.entries((await state()).fieldLocks ?? {}).some(
            ([key, locked]) => key.endsWith("Painkillers.location") && locked === true,
          ),
        )
        .toBe(true);
      await page.reload();
      await expect(location).toHaveText("Bedside table");
      await expect(description).toHaveText("Small white tablets");
      await expect(page.getByRole("button", { name: "Description for Brass key", exact: true })).toHaveText(
        "Marked with the number 17",
      );
      await page.getByRole("button", { name: "Open tracker settings", exact: true }).click();
      await page.getByRole("button", { name: "Enter tracker lock mode", exact: true }).click();
      await expect(page.getByRole("button", { name: "Exit tracker lock mode", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.getByRole("button", { name: /^Unlock.*Location for Painkillers/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.getByRole("button", { name: "Exit tracker lock mode", exact: true }).click();
      await page.getByRole("button", { name: "Close tracker settings", exact: true }).click();
      await page.screenshot({ path: testInfo.outputPath(`inventory-details-${theme}.png`) });
      const bounds = await location.evaluate((element) => ({
        right: element.getBoundingClientRect().right,
        width: document.documentElement.clientWidth,
      }));
      expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
    } finally {
      await page.close();
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
}

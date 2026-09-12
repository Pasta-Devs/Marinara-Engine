import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const theme of ["dark", "light"] as const) {
  test(`Game tool controls explain availability and persist independent choices (${theme})`, async ({
    page,
    request,
  }, testInfo) => {
    const narrator = await (
      await request.post("/api/connections", {
        data: { name: "Subscription narrator", provider: "claude_subscription", model: "fixture", apiKey: "synthetic" },
      })
    ).json();
    const planner = await (
      await request.post("/api/connections", {
        data: { name: "Budget tool model", provider: "openai", model: "fixture", apiKey: "synthetic" },
      })
    ).json();
    const chat = await (
      await request.post("/api/chats", {
        data: { name: "Game tools", mode: "game", characterIds: [], connectionId: narrator.id },
      })
    ).json();
    try {
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: {
          enableAgents: false,
          enableTools: false,
          gameId: chat.id,
          gameSessionStatus: "active",
          gameIntroPresented: true,
        },
      });
      await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "The harbor is quiet." },
      });
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["game"],
        gameInstantTextReveal: true,
        theme,
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chat.id, version },
      );
      const openTools = async () => {
        if (testInfo.project.name.includes("mobile"))
          await page.getByRole("button", { name: "Game actions", exact: true }).click();
        await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
        const section = page.locator('[data-chat-settings-section="function-calling"]');
        await section.locator('[role="button"][aria-expanded]').click();
        return section;
      };
      const metadata = async () => {
        const row = await (await request.get(`/api/chats/${chat.id}`)).json();
        return typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      };
      await page.goto("/");
      let section = await openTools();
      const tools = () => section.getByLabel("Enable Tool Use", { exact: true });
      const lore = () => section.getByLabel("Let the GM search lore", { exact: true });
      await expect(tools()).toBeDisabled();
      await expect(lore()).toBeDisabled();
      await expect(section.getByRole("status")).toContainText("Claude and Grok subscriptions");
      await section.getByRole("combobox", { name: "Game tool connection", exact: true }).selectOption(planner.id);
      await expect(tools()).toBeEnabled();
      await expect(lore()).toBeEnabled();
      await section
        .locator("label")
        .filter({ has: page.getByLabel("Let the GM search lore", { exact: true }) })
        .click();
      await expect.poll(async () => (await metadata()).gameLorebookSearch).toBe(true);
      expect((await metadata()).enableTools).toBe(false);
      expect((await metadata()).gameGmToolConnectionId).toBe(planner.id);
      await expect(section).toContainText("Adds one request per turn");
      await expect(section).toContainText("Vectorize books first");
      await page.reload();
      section = await openTools();
      await expect(section.getByRole("combobox", { name: "Game tool connection", exact: true })).toHaveValue(
        planner.id,
      );
      await expect(lore()).toBeChecked();
      await expect(tools()).not.toBeChecked();
      await section.evaluate((element) => element.scrollIntoView({ block: "start" }));
      await page.screenshot({ path: testInfo.outputPath(`game-tool-controls-${theme}.png`) });
      await section.getByRole("combobox", { name: "Game tool connection", exact: true }).selectOption("");
      await expect(tools()).toBeDisabled();
      await expect.poll(async () => (await metadata()).gameGmToolConnectionId).toBeNull();
      await request.patch(`/api/chats/${chat.id}/metadata`, { data: { gameGmToolConnectionId: "deleted-connection" } });
      await page.reload();
      section = await openTools();
      await expect(section.getByRole("combobox", { name: "Game tool connection", exact: true })).toHaveValue(
        "deleted-connection",
      );
      await expect(tools()).toBeDisabled();
      // A non-chat default in an imported connection list must not mask the
      // language default used by the narrator controls.
      await request.patch(`/api/chats/${chat.id}`, { data: { connectionId: null } });
      await request.patch(`/api/chats/${chat.id}/metadata`, { data: { gameGmToolConnectionId: null } });
      await page.route("**/api/connections", (route) =>
        route.fulfill({
          json: [
            { id: "imported-image-default", name: "Image", provider: "image_generation", isDefault: "true" },
            { ...planner, isDefault: "false" },
            { ...narrator, isDefault: "true" },
          ],
        }),
      );
      await page.reload();
      section = await openTools();
      await expect(tools()).toBeDisabled();
      await expect(lore()).toBeDisabled();
      await expect(section.getByRole("status")).toContainText("Claude and Grok subscriptions");
    } finally {
      await page.close();
      await request.delete(`/api/chats/${chat.id}?force=true`).catch(() => undefined);
      await request.delete(`/api/connections/${planner.id}`).catch(() => undefined);
      await request.delete(`/api/connections/${narrator.id}`).catch(() => undefined);
    }
  });
}

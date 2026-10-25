import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { chatSettingsDrawer, drawerToggle, openChatSettings } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const theme of ["dark", "light"] as const) {
  test(`agent lorebooks are chat-scoped and persistent (${theme})`, async ({ page }, testInfo) => {
    const ids = { chat: "", book: "", custom: "" };
    const create = async (path: string, data: unknown) => {
      const response = await page.request.post(`/api/${path}`, { data });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    await page.route("**/api/app-settings/ui", (route) =>
      route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
    );
    await page.route("**/api/capability-packages/agents", (route) =>
      route.fulfill({
        json: [
          {
            id: "prose-guardian",
            packageId: "prose-guardian",
            name: "Prose Guardian",
            description: "Writing fixture",
            phase: "post_processing",
            category: "writer",
            enabledByDefault: false,
            defaultPromptTemplate: "Write clearly.",
            defaultSettings: {},
          },
        ],
      }),
    );
    try {
      const custom = await create("agents", {
        type: `custom-reference-${theme}`,
        name: "Reference assistant",
        phase: "post_processing",
      });
      ids.custom = custom.id;
      const book = await create("lorebooks", { name: `Reference fixture ${theme}` });
      ids.book = book.id;
      const chat = await create("chats", { name: "Agent lorebook fixture", mode: "roleplay", characterIds: [] });
      ids.chat = chat.id;
      const patch = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
        data: {
          enableAgents: true,
          activeAgentIds: ["prose-guardian", custom.type],
          agentLorebookAttachments: { [custom.type]: { enabled: true, lorebookId: book.id } },
        },
      });
      expect(patch.ok()).toBeTruthy();
      await create(`chats/${chat.id}/messages`, { role: "assistant", content: "A quiet reference fixture." });
      await seedUIState(
        page,
        {
          hasCompletedOnboarding: true,
          rightPanelOpen: false,
          sidebarOpen: false,
          appAccentPulseMode: false,
          theme,
          chatHelpSeenModes: ["conversation", "roleplay", "game"],
        },
        "if-missing",
      );
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chat.id, version },
      );
      const open = async () => {
        await openChatSettings(page);
        const drawer = chatSettingsDrawer(page, "agents");
        const toggle = drawerToggle(drawer);
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
        return page.locator('[data-agent-lorebook-attachment="prose-guardian"]').first();
      };
      await page.goto("/");
      await expect(page.getByText("A quiet reference fixture.", { exact: true })).toBeVisible();
      let attachment = await open();
      await expect(attachment).toBeVisible();
      const checkbox = () => attachment.getByRole("checkbox", { name: "Attach lorebook for the specific agent" });
      await expect(checkbox()).not.toBeChecked();
      await expect(attachment.getByRole("combobox")).toHaveCount(0);
      await attachment.getByText("Attach lorebook for the specific agent", { exact: true }).click();
      const select = () => attachment.getByRole("combobox", { name: "Reference lorebook" });
      await expect(select()).toBeEnabled();
      await select().selectOption(book.id);
      const metadata = async () => (await (await page.request.get(`/api/chats/${chat.id}`)).json()).metadata;
      await expect
        .poll(async () => (await metadata()).agentLorebookAttachments["prose-guardian"].lorebookId)
        .toBe(book.id);
      expect((await metadata()).agentLorebookAttachments[custom.type]).toEqual({ enabled: true, lorebookId: book.id });
      const bounds = await attachment.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await testInfo.attach(`agent-lorebook-${theme}`, {
        body: await page.screenshot({ path: testInfo.outputPath(`agent-lorebook-${theme}.png`) }),
        contentType: "image/png",
      });
      await page.reload();
      attachment = await open();
      await expect(checkbox()).toBeChecked();
      await expect(select()).toHaveValue(book.id);
      await attachment.getByText("Attach lorebook for the specific agent", { exact: true }).click();
      await expect.poll(async () => (await metadata()).agentLorebookAttachments["prose-guardian"].enabled).toBe(false);
      await expect(select()).toHaveCount(0);
      await attachment.getByText("Attach lorebook for the specific agent", { exact: true }).click();
      await expect(select()).toHaveValue(book.id);
      const hidden = await page.request.patch(`/api/lorebooks/${book.id}`, { data: { hiddenFromLibrary: true } });
      expect(hidden.ok(), await hidden.text()).toBeTruthy();
      await page.reload();
      attachment = await open();
      await expect(select()).toHaveValue(book.id);
      await expect(select().locator(`option[value="${book.id}"]`)).toHaveText(book.name);
      await expect(select().locator(`option[value="${book.id}"]`)).toHaveJSProperty("disabled", true);
      await expect(
        attachment.getByText("Select another lorebook. An unavailable attachment adds no reference context."),
      ).toHaveCount(0);
      await page.request.delete(`/api/lorebooks/${book.id}`);
      ids.book = "";
      await page.reload();
      attachment = await open();
      await expect(select()).toHaveValue(book.id);
      await expect(
        attachment.getByText("Select another lorebook. An unavailable attachment adds no reference context."),
      ).toBeVisible();
    } finally {
      if (ids.chat) await page.request.delete(`/api/chats/${ids.chat}`);
      if (ids.book) await page.request.delete(`/api/lorebooks/${ids.book}`);
      if (ids.custom) await page.request.delete(`/api/agents/${ids.custom}`);
    }
  });
}

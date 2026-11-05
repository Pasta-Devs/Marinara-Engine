import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { chatSettingsDrawer, drawerToggle, openChatSettings } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const saveError = "Could not save this agent's lorebook attachment. Please try again.";

for (const theme of ["dark", "light"] as const) {
  test(`agent lorebook saves report failures and preserve later choices (${theme})`, async ({ page }, testInfo) => {
    const ids = { chat: "", books: [] as string[] };
    let releaseHeld!: () => void;
    const held = new Promise<void>((resolve) => {
      releaseHeld = resolve;
    });
    let behavior: "validation" | "offline" | "held-validation" | "success" = "validation";
    const writes: Array<Record<string, any>> = [];
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
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
            description: "Fixture",
            phase: "post_processing",
            category: "writer",
            enabledByDefault: false,
            defaultPromptTemplate: "Write clearly.",
            defaultSettings: {},
          },
        ],
      }),
    );
    const create = async (path: string, data: unknown) => {
      const response = await page.request.post(`/api/${path}`, { data });
      expect(response.ok(), await response.text()).toBeTruthy();
      return response.json();
    };
    try {
      const first = await create("lorebooks", { name: `Saved reference ${theme}` });
      ids.books.push(first.id);
      const second = await create("lorebooks", { name: `Alternative reference ${theme}` });
      ids.books.push(second.id);
      const chat = await create("chats", { name: "Reference save failures", mode: "roleplay", characterIds: [] });
      ids.chat = chat.id;
      const response = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
        data: {
          enableAgents: true,
          activeAgentIds: ["prose-guardian"],
          agentLorebookAttachments: {
            "prose-guardian": { enabled: true, lorebookId: first.id },
            "preserved-agent": { enabled: true, lorebookId: second.id },
          },
        },
      });
      expect(response.ok()).toBeTruthy();
      await create(`chats/${chat.id}/messages`, { role: "assistant", content: "A save failure fixture." });
      await page.route(`**/api/chats/${chat.id}/metadata`, async (route) => {
        if (route.request().method() !== "PATCH") return route.continue();
        const body = route.request().postDataJSON();
        if (!Object.hasOwn(body, "agentLorebookAttachments")) return route.continue();
        writes.push(body);
        const current = behavior;
        if (current === "held-validation") {
          behavior = "success";
          await held;
        }
        if (current === "validation" || current === "held-validation") {
          return route.fulfill({ status: 400, json: { error: "Fixture attachment validation failure" } });
        }
        if (current === "offline") return route.abort("failed");
        return route.continue();
      });
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
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.getByText("A save failure fixture.", { exact: true })).toBeVisible();
      await openChatSettings(page);
      const drawer = drawerToggle(chatSettingsDrawer(page, "agents"));
      if ((await drawer.getAttribute("aria-expanded")) !== "true") await drawer.click();
      const attachment = page.locator('[data-agent-lorebook-attachment="prose-guardian"]').first();
      const toggle = attachment.getByRole("checkbox", { name: "Attach lorebook for the specific agent" });
      const toggleLabel = attachment.getByText("Attach lorebook for the specific agent", { exact: true });
      const select = attachment.getByRole("combobox", { name: "Reference lorebook" });
      const metadata = async () => (await (await page.request.get(`/api/chats/${chat.id}`)).json()).metadata;
      const errorToast = page.locator('[data-sonner-toast][data-type="error"]').filter({ hasText: saveError });
      const dismissError = async () => {
        for (const toast of await errorToast.all()) await toast.locator("[data-close-button]").click();
        await expect(errorToast).toHaveCount(0);
      };

      // A refused toggle rolls back and explains how to retry.
      await expect(toggle).toBeChecked();
      await toggleLabel.click();
      await expect.poll(() => writes.length).toBe(1);
      await expect(toggle).toBeChecked();
      await expect(select).toHaveValue(first.id);
      await expect.soft(errorToast).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`attachment-save-error-${theme}.png`),
        animations: "disabled",
      });
      await dismissError();

      // A dropped selection request also rolls back, with the same accessible toast.
      behavior = "offline";
      await select.selectOption(second.id);
      await expect.poll(() => writes.length).toBe(2);
      await expect(select).toBeEnabled();
      await expect(select).toHaveValue(first.id);
      await expect.soft(errorToast).toBeVisible();
      await dismissError();

      // Hold an older failure while a later choice queues. Its error must not undo the later success.
      behavior = "held-validation";
      await toggleLabel.click();
      await expect.poll(() => writes.length).toBe(3);
      await expect(toggle).not.toBeChecked();
      await toggleLabel.click();
      await expect(toggle).toBeChecked();
      releaseHeld();
      await expect.poll(() => writes.length).toBe(4);
      await expect(select).toBeEnabled();
      await expect(toggle).toBeChecked();
      await expect(select).toHaveValue(first.id);
      await expect
        .poll(async () => (await metadata()).agentLorebookAttachments)
        .toEqual({
          "prose-guardian": { enabled: true, lorebookId: first.id },
          "preserved-agent": { enabled: true, lorebookId: second.id },
        });
      await expect.soft(errorToast).toBeVisible();
      expect(writes.map((write) => write.agentLorebookAttachments["prose-guardian"])).toEqual([
        { enabled: false },
        { lorebookId: second.id },
        { enabled: false },
        { enabled: true },
      ]);
      expect(pageErrors).toEqual([]);
    } finally {
      releaseHeld();
      if (ids.chat) await page.request.delete(`/api/chats/${ids.chat}`);
      for (const id of ids.books) await page.request.delete(`/api/lorebooks/${id}`);
    }
  });
}

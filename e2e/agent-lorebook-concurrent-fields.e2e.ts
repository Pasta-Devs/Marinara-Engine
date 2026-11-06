import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { chatSettingsDrawer, drawerToggle, openChatSettings } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const theme of ["dark", "light"] as const) {
  for (const control of ["toggle", "selection"] as const) {
    test(`agent attachment ${control} preserves the other writer's field (${theme})`, async ({ page }, testInfo) => {
      const ids = { chat: "", books: [] as string[] };
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
      const save = async (attachments: Record<string, unknown>) => {
        const response = await page.request.patch(`/api/chats/${ids.chat}/metadata`, {
          data: { agentLorebookAttachments: attachments },
        });
        expect(response.ok(), await response.text()).toBeTruthy();
        return response.json();
      };
      try {
        for (const name of ["Rendered reference", "Concurrent reference", "Chosen reference"]) {
          ids.books.push((await create("lorebooks", { name: `${name} ${theme} ${control}` })).id);
        }
        ids.chat = (
          await create("chats", { name: "Independent attachment fields", mode: "roleplay", characterIds: [] })
        ).id;
        const setup = await page.request.patch(`/api/chats/${ids.chat}/metadata`, {
          data: {
            enableAgents: true,
            activeAgentIds: ["prose-guardian"],
            agentLorebookAttachments: {
              "prose-guardian": { enabled: true, lorebookId: ids.books[0] },
              sibling: { enabled: true, lorebookId: ids.books[1] },
            },
          },
        });
        expect(setup.ok()).toBeTruthy();
        await create(`chats/${ids.chat}/messages`, { role: "assistant", content: "An independent field fixture." });
        await page.route(`**/api/chats/${ids.chat}/metadata`, (route) => {
          const body = route.request().postDataJSON();
          if (body?.agentLorebookAttachments) writes.push(body.agentLorebookAttachments["prose-guardian"]);
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
          { id: ids.chat, version },
        );
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page.getByText("An independent field fixture.", { exact: true })).toBeVisible();
        await openChatSettings(page);
        const drawer = drawerToggle(chatSettingsDrawer(page, "agents"));
        if ((await drawer.getAttribute("aria-expanded")) !== "true") await drawer.click();
        const attachment = page.locator('[data-agent-lorebook-attachment="prose-guardian"]').first();
        const toggle = attachment.getByRole("checkbox", { name: "Attach lorebook for the specific agent" });
        const select = attachment.getByRole("combobox", { name: "Reference lorebook" });
        await expect(toggle).toBeChecked();
        await expect(select).toHaveValue(ids.books[0]!);

        // A real second HTTP writer changes the same entry without touching this browser's cache.
        await save({ "prose-guardian": { enabled: control === "toggle", lorebookId: ids.books[1] } });
        await expect(toggle).toBeChecked();
        await expect(select).toHaveValue(ids.books[0]!);
        if (control === "toggle") {
          await attachment.getByText("Attach lorebook for the specific agent", { exact: true }).click();
        } else {
          await select.selectOption(ids.books[2]!);
        }
        await expect.poll(() => writes.length).toBe(1);
        const expected = { enabled: false, lorebookId: ids.books[control === "toggle" ? 1 : 2] };
        await expect
          .poll(async () => {
            const response = await page.request.get(`/api/chats/${ids.chat}`);
            return (await response.json()).metadata.agentLorebookAttachments;
          })
          .toEqual({ "prose-guardian": expected, sibling: { enabled: true, lorebookId: ids.books[1] } });
        expect(writes).toEqual([control === "toggle" ? { enabled: false } : { lorebookId: ids.books[2] }]);
        await expect(toggle).not.toBeChecked();
        await page.screenshot({
          path: testInfo.outputPath(`attachment-concurrent-${control}-${theme}.png`),
          animations: "disabled",
        });
        expect(pageErrors).toEqual([]);
      } finally {
        if (ids.chat) await page.request.delete(`/api/chats/${ids.chat}`);
        for (const id of ids.books) await page.request.delete(`/api/lorebooks/${id}`);
      }
    });
  }
}

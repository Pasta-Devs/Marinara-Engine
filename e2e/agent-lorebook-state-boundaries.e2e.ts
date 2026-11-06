import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { chatSettingsDrawer, drawerToggle, openChatSettings } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const theme of ["dark", "light"] as const) {
  test(`agent reference query and mutation boundaries (${theme})`, async ({ page }) => {
    let releaseCold!: () => void;
    const cold = new Promise<void>((resolve) => {
      releaseCold = resolve;
    });
    let coldEntered = false;
    let holdCold = true;
    let failWarm = false;
    let warmReads = 0;
    const ids = { chat: "", book: "" };
    const writes: Array<Record<string, unknown>> = [];
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
    try {
      const bookResponse = await page.request.post("/api/lorebooks", { data: { name: `State boundary ${theme}` } });
      expect(bookResponse.ok()).toBeTruthy();
      const book = await bookResponse.json();
      ids.book = book.id;
      const chatResponse = await page.request.post("/api/chats", {
        data: { name: "Reference state boundary", mode: "roleplay", characterIds: [] },
      });
      expect(chatResponse.ok()).toBeTruthy();
      const chat = await chatResponse.json();
      ids.chat = chat.id;
      const select = async () => {
        const response = await page.request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            enableAgents: true,
            activeAgentIds: ["prose-guardian"],
            agentLorebookAttachments: {
              "prose-guardian": { enabled: true, lorebookId: book.id },
              "preserved-agent": { enabled: true, lorebookId: book.id },
            },
          },
        });
        expect(response.ok()).toBeTruthy();
      };
      await select();
      await page.request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "A state boundary fixture." },
      });
      await page.route(`**/api/chats/${chat.id}`, async (route) => {
        if (route.request().method() !== "GET") return route.continue();
        if (failWarm) {
          warmReads += 1;
          return route.fulfill({ status: 503, json: { error: "Fixture detail outage" } });
        }
        const response = await route.fetch();
        if (holdCold) {
          coldEntered = true;
          await cold;
        }
        return route.fulfill({ response });
      });
      page.on("request", (request) => {
        if (request.method() === "PATCH" && new URL(request.url()).pathname === `/api/chats/${chat.id}/metadata`) {
          const body = request.postDataJSON();
          if (Object.hasOwn(body, "agentLorebookAttachments")) writes.push(body);
        }
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
      await expect.poll(() => coldEntered).toBeTruthy();
      const attachment = page.locator('[data-agent-lorebook-attachment="prose-guardian"]').first();
      await expect(attachment).toHaveCount(0);
      expect(writes).toHaveLength(0);
      holdCold = false;
      releaseCold();
      await expect(page.getByText("A state boundary fixture.", { exact: true })).toBeVisible();
      await openChatSettings(page);
      const drawer = drawerToggle(chatSettingsDrawer(page, "agents"));
      if ((await drawer.getAttribute("aria-expanded")) !== "true") await drawer.click();
      const toggle = attachment.getByRole("checkbox", { name: "Attach lorebook for the specific agent" });
      await expect(toggle).toBeChecked();
      await expect(attachment.getByRole("combobox", { name: "Reference lorebook" })).toHaveValue(book.id);

      failWarm = true;
      await page.evaluate(async (id) => {
        const { queryClient } = await import("/src/lib/query-client.ts" as string);
        void queryClient.invalidateQueries({ queryKey: ["chats", "detail", id] });
      }, chat.id);
      await expect.poll(() => warmReads).toBeGreaterThan(0);
      await expect
        .poll(
          () =>
            page.evaluate(async (id) => {
              const { queryClient } = await import("/src/lib/query-client.ts" as string);
              return queryClient.getQueryState(["chats", "detail", id])?.status;
            }, chat.id),
          { timeout: 15_000 },
        )
        .toBe("error");
      await expect(toggle).toBeChecked();
      await expect(attachment.getByRole("combobox", { name: "Reference lorebook" })).toHaveValue(book.id);
      await attachment.getByText("Attach lorebook for the specific agent", { exact: true }).click();
      await expect.poll(() => writes.length).toBe(1);
      expect(writes[0]!.agentLorebookAttachments).toEqual({
        "prose-guardian": { enabled: false },
      });
      const metadata = async () => (await (await page.request.get(`/api/chats/${chat.id}`)).json()).metadata;
      await expect
        .poll(async () => (await metadata()).agentLorebookAttachments["prose-guardian"])
        .toEqual({ enabled: false, lorebookId: book.id });
      failWarm = false;

      const legacyMaps = [
        { broken: null, "prose-guardian": { enabled: true, lorebookId: book.id } },
        ["legacy-value"],
        [{ enabled: true, lorebookId: book.id }],
      ];
      for (let index = 0; index < legacyMaps.length; index += 1) {
        await select();
        await page.evaluate(
          async ({ id, attachments }) => {
            const { queryClient } = await import("/src/lib/query-client.ts" as string);
            queryClient.setQueryData(["chats", "detail", id], (old: any) => ({
              ...old,
              metadata: { ...old.metadata, agentLorebookAttachments: attachments },
            }));
          },
          { id: chat.id, attachments: legacyMaps[index] },
        );
        const checked = index === 0;
        if (checked) await expect(toggle).toBeChecked();
        else await expect(toggle).not.toBeChecked();
        const before = writes.length;
        await attachment.getByText("Attach lorebook for the specific agent", { exact: true }).click();
        await expect.poll(() => writes.length).toBe(before + 1);
        const expected = { enabled: !checked, lorebookId: book.id };
        expect(writes.at(-1)!.agentLorebookAttachments).toEqual({ "prose-guardian": { enabled: !checked } });
        await expect.poll(async () => (await metadata()).agentLorebookAttachments["prose-guardian"]).toEqual(expected);
        const saved = (await metadata()).agentLorebookAttachments;
        expect(saved["0"]).toBeUndefined();
        expect(saved.broken).toBeUndefined();
        expect(saved["preserved-agent"]).toEqual({ enabled: true, lorebookId: book.id });
      }
    } finally {
      releaseCold();
      if (ids.chat) await page.request.delete(`/api/chats/${ids.chat}`);
      if (ids.book) await page.request.delete(`/api/lorebooks/${ids.book}`);
    }
  });
}

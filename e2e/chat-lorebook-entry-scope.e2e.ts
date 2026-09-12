import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const mode of ["game", "roleplay", "conversation"] as const) {
  test(`${mode} entry switches affect only this chat`, async ({ page, request }, testInfo) => {
    const a = await (
      await request.post("/api/chats", { data: { name: "Lore scope A", mode, characterIds: [] } })
    ).json();
    const b = await (
      await request.post("/api/chats", { data: { name: "Lore scope B", mode, characterIds: [] } })
    ).json();
    const book = await (
      await request.post("/api/lorebooks", {
        data: { name: "Scoped book", scope: { mode: "specific", chatIds: [a.id, b.id] } },
      })
    ).json();
    const entry = await (
      await request.post(`/api/lorebooks/${book.id}/entries`, {
        data: { name: "Dockmaster", content: "Runs the docks", keys: ["dock"] },
      })
    ).json();
    try {
      for (const id of [a.id, b.id]) {
        expect(
          (
            await request.patch(`/api/chats/${id}/metadata`, {
              data: {
                activeLorebookIds: [book.id],
                enableAgents: false,
                gameId: id,
                gameSessionStatus: "active",
                gameIntroPresented: true,
                ...(id === a.id ? { entryStateOverrides: { [entry.id]: { ephemeral: 3 } } } : {}),
              },
            })
          ).ok(),
        ).toBeTruthy();
        await request.post(`/api/chats/${id}/messages`, { data: { role: "assistant", content: "A quiet square." } });
      }
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: [mode],
        gameInstantTextReveal: true,
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: a.id, version },
      );
      const openEditor = async () => {
        if (testInfo.project.name.includes("mobile"))
          await page
            .getByRole("button", { name: mode === "game" ? "Game actions" : "More options", exact: true })
            .click();
        await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
        const drawer = page.locator(".mari-chat-settings-drawer");
        await drawer.getByText("Lorebooks", { exact: true }).first().click();
        await drawer.getByRole("button", { name: "Edit lorebook entries", exact: true }).click();
        return drawer.locator(`[data-lorebook-entry-row-id="${entry.id}"]`);
      };
      const globalEntry = async () =>
        (await (await request.get(`/api/lorebooks/${book.id}/entries`)).json()).find(
          (row: { id: string }) => row.id === entry.id,
        );
      const metadata = async (id: string) => {
        const chat = await (await request.get(`/api/chats/${id}`)).json();
        return typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
      };
      await page.goto("/");
      let row = await openEditor();
      await row
        .locator("label")
        .filter({ has: page.getByRole("checkbox", { name: "Disable entry for this chat", exact: true }) })
        .click();
      await expect
        .poll(async () => (await metadata(a.id)).entryStateOverrides[entry.id])
        .toEqual({ ephemeral: 3, enabled: false });
      expect((await globalEntry()).enabled).toBe(true);
      expect((await metadata(b.id)).entryStateOverrides).toBeUndefined();
      await row.getByRole("button", { name: "Expand entry", exact: true }).click();
      await row
        .getByPlaceholder("The content that will be injected into the prompt when this entry activates…", {
          exact: true,
        })
        .fill("Updated shared dock lore");
      await row
        .getByPlaceholder("The content that will be injected into the prompt when this entry activates…", {
          exact: true,
        })
        .blur();
      await expect.poll(async () => (await globalEntry()).content).toBe("Updated shared dock lore");
      expect((await globalEntry()).enabled, "content edits cannot leak the chat's disabled flag").toBe(true);
      await page.reload();
      row = await openEditor();
      await expect(row.getByRole("checkbox", { name: "Enable entry for this chat", exact: true })).not.toBeChecked();
      await row
        .locator("label")
        .filter({ has: page.getByRole("checkbox", { name: "Enable entry for this chat", exact: true }) })
        .click();
      await expect
        .poll(async () => (await metadata(a.id)).entryStateOverrides[entry.id])
        .toEqual({ ephemeral: 3, enabled: true });
      await request.patch(`/api/lorebooks/${book.id}/entries/${entry.id}`, { data: { enabled: false } });
      await page.reload();
      row = await openEditor();
      await expect(row.getByRole("checkbox", { name: "Enable entry for this chat", exact: true })).toBeDisabled();
      await row.screenshot({ path: testInfo.outputPath(`chat-lore-scope-${mode}.png`) });
    } finally {
      await page.close();
      await Promise.all([
        request.delete(`/api/chats/${a.id}?force=true`).catch(() => undefined),
        request.delete(`/api/chats/${b.id}?force=true`).catch(() => undefined),
        request.delete(`/api/lorebooks/${book.id}`).catch(() => undefined),
      ]);
    }
  });
}

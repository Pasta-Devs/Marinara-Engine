import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

type SavedSet = { id: string; name: string; itemIds: string[] };

async function savedSets(request: APIRequestContext) {
  return (await (await request.get("/api/library-folders/lorebook-sets")).json()) as SavedSet[];
}

// #9672: a saved lorebook set is made in the Lorebooks panel, then picked in the New Roleplay wizard. The chat gets
// the set's lorebooks, and the changes made for that chat never reach the saved set.
test("a saved lorebook set fills a new roleplay's lorebooks without changing the set", async ({ page, request }) => {
  const stamp = Date.now();
  const bookIds: string[] = [];
  const chatIds: string[] = [];
  const setIdsBefore = new Set((await savedSets(request)).map((set) => set.id));
  for (const endpoint of ["capability-packages/agents", "capability-packages/installed", "agents"])
    await page.route(`**/api/${endpoint}`, (route) => route.fulfill({ json: [] }));
  const createBook = async (name: string) => {
    const response = await request.post("/api/lorebooks", { data: { name } });
    expect(response.ok()).toBeTruthy();
    const book = (await response.json()) as { id: string };
    bookIds.push(book.id);
    return book.id;
  };
  try {
    const north = await createBook(`North ${stamp}`);
    const south = await createBook(`South ${stamp}`);
    const elsewhere = await createBook(`Elsewhere ${stamp}`);
    const gone = await createBook(`Gone ${stamp}`);
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Set roleplay", mode: "roleplay", characterIds: [] },
    });
    expect(chatResponse.ok()).toBeTruthy();
    const chat = (await chatResponse.json()) as { id: string };
    chatIds.push(chat.id);

    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      appAccentPulseMode: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");

    // Make the set in the Lorebooks panel.
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openRightPanel("lorebooks");
    });
    const sets = page.locator('[data-component="LorebookSetsSection"]');
    await sets.getByRole("button", { name: "New set", exact: true }).click();
    const nameField = sets.getByLabel("Set name", { exact: true });
    await expect(nameField).toBeVisible();
    await nameField.fill(`Northern AU ${stamp}`);
    await nameField.press("Enter");
    await expect
      .poll(async () => (await savedSets(request)).find((set) => !setIdsBefore.has(set.id))?.name)
      .toBe(`Northern AU ${stamp}`);
    await sets.getByRole("button", { name: `Lorebooks in Northern AU ${stamp}`, exact: true }).click();
    const bookWindow = page.getByRole("dialog", { name: /^Lorebooks/u });
    await bookWindow.locator(`[data-pick-row][title="North ${stamp}"]`).click();
    await bookWindow.locator(`[data-pick-row][title="South ${stamp}"]`).click();
    await bookWindow.locator(`[data-pick-row][title="Gone ${stamp}"]`).click();
    await bookWindow.press("Escape");
    const newSetItems = async () => (await savedSets(request)).find((set) => !setIdsBefore.has(set.id))?.itemIds;
    await expect.poll(newSetItems).toEqual([north, south, gone]);

    // Deleting a lorebook while its set is open drops it from the set, and the editor's next save keeps it out.
    const setRow = sets.getByRole("button", { name: new RegExp(`^Northern AU ${stamp}`, "u") });
    await expect(setRow.getByText("3 lorebooks", { exact: true })).toBeVisible();
    const goneRow = page.locator(`[data-touch-drag-card="lorebook"][data-drag-id="${gone}"]`);
    await goneRow.hover();
    await goneRow.getByTitle("Delete", { exact: true }).click();
    await page
      .getByRole("dialog", { name: "Delete Lorebook", exact: true })
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(setRow.getByText("2 lorebooks", { exact: true })).toBeVisible();
    await sets.getByRole("button", { name: `Lorebooks in Northern AU ${stamp}`, exact: true }).click();
    await bookWindow.locator(`[data-pick-row][title="Elsewhere ${stamp}"]`).click();
    await expect.poll(newSetItems).toEqual([north, south, elsewhere]);
    await bookWindow.locator(`[data-pick-row][title="Elsewhere ${stamp}"]`).click();
    await bookWindow.press("Escape");
    await expect.poll(newSetItems).toEqual([north, south]);
    await expect(setRow.getByText("2 lorebooks", { exact: true })).toBeVisible();
    const saved = (await savedSets(request)).find((set) => !setIdsBefore.has(set.id))!;

    // Pick it in the New Roleplay wizard.
    await page.evaluate(async (id) => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeRightPanel();
      useChatStore.getState().setActiveChatId(id);
    }, chat.id);
    await expect
      .poll(() =>
        page.evaluate(async (id) => {
          const { queryClient } = await import("/src/lib/query-client.ts" as string);
          return queryClient.getQueryData(["chats", "detail", id])?.id;
        }, chat.id),
      )
      .toBe(chat.id);
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenWizard(true);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const wizard = page.locator('[data-component="ChatSetupWizard"]');
    await expect(wizard).toBeVisible();
    const lorebookStep = wizard.getByRole("heading", { name: "Attach Lorebooks", exact: true });
    const choices = page.getByRole("dialog", { name: "Configure Preset Variables", exact: true });
    for (let guard = 0; guard < 8 && !(await lorebookStep.isVisible()); guard++) {
      const heading = wizard.getByRole("heading", { level: 4 }).first();
      const previous = await heading.innerText();
      await wizard.getByRole("button", { name: "Next", exact: true }).click();
      await expect.poll(async () => (await choices.isVisible()) || (await heading.innerText()) !== previous).toBe(true);
      if (await choices.isVisible()) await choices.getByRole("button", { name: "Skip", exact: true }).click();
      await expect(heading).not.toHaveText(previous);
    }
    await expect(lorebookStep).toBeVisible();

    const setTrigger = wizard.locator("[data-lorebook-set-trigger]");
    await expect(setTrigger).toHaveText("Use a saved set");
    await setTrigger.click();
    await page
      .getByRole("dialog", { name: "Lorebook set", exact: true })
      .locator(`[data-pick-row][title="Northern AU ${stamp}"]`)
      .click();
    const chatBooks = async () =>
      (await (await request.get(`/api/chats/${chat.id}`)).json()).metadata?.activeLorebookIds as string[] | undefined;
    await expect.poll(chatBooks).toEqual([north, south]);
    await expect(setTrigger).toHaveText(`Northern AU ${stamp}`);

    // A change for this chat only: the saved set keeps both lorebooks.
    await wizard.getByRole("button", { name: `Remove South ${stamp}`, exact: true }).click();
    await expect.poll(chatBooks).toEqual([north]);
    await expect(setTrigger).toHaveText("Use a saved set");
    expect((await savedSets(request)).find((set) => set.id === saved.id)?.itemIds).toEqual([north, south]);
  } finally {
    for (const set of await savedSets(request))
      if (!setIdsBefore.has(set.id)) await request.delete(`/api/library-folders/lorebook-sets/${set.id}`);
    for (const id of chatIds) await request.delete(`/api/chats/${id}`);
    for (const id of bookIds) await request.delete(`/api/lorebooks/${id}`);
  }
});

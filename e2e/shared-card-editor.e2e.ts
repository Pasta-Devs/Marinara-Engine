import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

for (const kind of ["characters", "personas"] as const) {
  test(kind + " editor keeps typing during save and reopens the saved draft", async ({ page, request }, testInfo) => {
    const character = kind === "characters";
    // The mobile projects share one server, so each project gets its own card.
    const name = (character ? "River Vale " : "June Vale ") + testInfo.project.name;
    const url = character ? "/api/characters" : "/api/characters/personas";
    const card = { name, description: "A cartographer who keeps a field journal." };
    const res = await request.post(url, { data: character ? { data: card } : card });
    expect(res.ok(), await res.text()).toBeTruthy();
    const { id } = await res.json();
    const path = url + "/" + id;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
      await page.route("**/api/app-settings/ui", (route) =>
        route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
      );
      await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
      const open = async (label: string) => {
        await page.goto("/");
        await clickTopbarPanel(page, kind);
        await page.getByText(label, { exact: true }).first().click();
      };
      // Desktop shows a tab strip; narrow layouts fold the tabs into a menu.
      const openCardTab = async () => {
        const tab = page.locator(".mari-editor-navigation-tabs").getByRole("button", { name: "Card", exact: true });
        if (await tab.isVisible()) await tab.click();
        else {
          await page.locator(".mari-editor-navigation-select").click();
          await page.getByRole("menuitemradio", { name: "Card", exact: true }).click();
        }
      };
      await open(name);
      const title = page.locator(".mari-editor-shell .mari-editor-title-input");
      const save = page.locator(".mari-editor-header .mari-editor-action--save");
      await expect(title).toHaveValue(name);
      await page.screenshot({ path: testInfo.outputPath("editor.png"), animations: "disabled" });
      // Both editors render the Card tab through the shared CardFieldsTab.
      await openCardTab();
      const sectionPrefix = (character ? "#character" : "#persona") + "-card-";
      const description = page.locator(sectionPrefix + 'description [data-mari-field="description"] textarea');
      await expect(description).toHaveValue(card.description);
      for (const field of ["personality", "backstory", "appearance", "scenario"]) {
        await expect(page.locator(sectionPrefix + field)).toBeAttached();
      }
      await page.screenshot({ path: testInfo.outputPath("card.png"), animations: "disabled" });
      const finalDescription = "A cartographer who maps the tide caves.";
      await page.route("**" + path, async (route) => {
        if (route.request().method() === "PATCH") await gate;
        await route.continue();
      });
      const summary = page.locator('#character-card-summary [data-mari-field="summary"] textarea');
      if (character) await summary.fill("A knight. Brave ");
      await title.fill(name + " first");
      const started = page.waitForRequest((req) => new URL(req.url()).pathname === path && req.method() === "PATCH");
      await save.click();
      await started;
      if (character) {
        // Keep and pre-send call the same registered editor save. Start it while the PATCH is held.
        await page.evaluate(async () => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          Object.assign(window, { mariPresaveResult: useUIStore.getState().mariEditorSave() });
        });
        await summary.fill("A knight. Brave and kind");
      }
      const finalName = name + " final";
      await title.fill(finalName);
      await description.fill(finalDescription);
      const done = page.waitForResponse(
        (res) => new URL(res.url()).pathname === path && res.request().method() === "PATCH",
      );
      // The character editor refetches the card after a save.
      const echo = character
        ? page.waitForResponse((res) => new URL(res.url()).pathname === path && res.request().method() === "GET")
        : null;
      release();
      expect((await done).ok()).toBeTruthy();
      await echo;
      if (character) {
        const result = await page.evaluate(
          () => (window as Window & { mariPresaveResult?: Promise<string> }).mariPresaveResult,
        );
        expect(result).toBe("saved");
      } else await expect(save).toBeEnabled();
      // The save's own refetch is not an edit made elsewhere.
      await expect(page.getByText("changed while you were editing", { exact: false })).toHaveCount(0);
      await expect(title).toHaveValue(finalName);
      await expect(description).toHaveValue(finalDescription);
      if (!character) await save.click();
      await expect(save).toBeDisabled();
      await expect
        .poll(async () => {
          const row = await (await request.get(path)).json();
          const saved = character ? (typeof row.data === "string" ? JSON.parse(row.data) : row.data) : row;
          return [saved.name, saved.description, ...(character ? [saved.summary] : [])];
        })
        .toEqual([finalName, finalDescription, ...(character ? ["A knight. Brave and kind"] : [])]);
      await open(finalName);
      await expect(title).toHaveValue(finalName);
      await openCardTab();
      await expect(description).toHaveValue(finalDescription);
    } finally {
      release();
      await request.delete(path);
    }
  });
}

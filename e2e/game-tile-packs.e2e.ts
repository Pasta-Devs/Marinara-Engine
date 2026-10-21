import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { WORLD_GENERATOR_VERSION, WORLD_STARTER_KITS, parseWorldKit } from "@marinara-engine/shared";
import { openGame } from "./game-ruleset-fight-fixture.js";
import { seedUIState } from "./ui-state-fixture.js";
import { downloadExport } from "./export-save.js";

/**
 * Tile packs (worldgen W9a), on screen: a pack file is imported into the library in the Agents panel,
 * chosen for a setting family, drawn on that family's overworld, exported, and removed, which sends the
 * family back to its own tiles.
 */

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const rows = (char: string) => Array.from({ length: 16 }, () => char.repeat(16));
const file = {
  tilePackVersion: 1,
  id: "night-meadows",
  name: "Night meadows",
  family: "fantasy",
  version: 1,
  palette: ["#203040", "#405060"],
  tiles: { grass: [rows("0"), rows("1")], party: [rows("1")] },
};

test("a tile pack is imported, chosen for its family, drawn on the overworld, exported and removed", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  let chatId = "";
  try {
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript((seen) => localStorage.setItem("marinara:whats-new:seen-version", seen), version);
    await page.goto("/");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openRightPanel("agents");
    });

    // Import.
    await expect(page.getByRole("button", { name: "Import a tile pack", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.locator('input[type="file"][accept=".json,application/json"]').setInputFiles({
      name: "night-meadows.tilepack.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(file)),
    });
    await expect(page.getByText("Imported Night meadows.", { exact: true })).toBeVisible();
    await expect(page.getByText("Fantasy, version 1", { exact: true })).toBeVisible();

    // Chosen for fantasy.
    await page.getByRole("combobox", { name: "Tiles for Fantasy", exact: true }).selectOption("local/night-meadows");
    await expect
      .poll(async () => (await (await request.get("/api/game-tile-packs")).json()).selection)
      .toEqual({ fantasy: "local/night-meadows" });
    await page.screenshot({ path: testInfo.outputPath("tile-packs-panel.png") });

    // #7115 intentionally offers an iPhone Save file action before the browser download.
    const download = await downloadExport(page, () =>
      page.getByRole("button", { name: "Export Night meadows", exact: true }).click(),
    );
    expect(download.suggestedFilename()).toBe("Night_meadows.tilepack.json");
    const exported = JSON.parse(await readFile(await download.path(), "utf8"));
    expect(exported.tiles.grass).toEqual(file.tiles.grass);

    // A fantasy world's overworld is drawn with it.
    const parsed = parseWorldKit(WORLD_STARTER_KITS.find((kit) => kit.id === "high_fantasy")!);
    if (!parsed.ok) throw new Error("The high fantasy kit does not read");
    const created = await request.post("/api/chats", { data: { name: "Tiles", mode: "game", characterIds: [] } });
    chatId = ((await created.json()) as { id: string }).id;
    expect(
      (
        await request.patch(`/api/chats/${chatId}/metadata`, {
          data: {
            gameId: `tiles-${chatId}`,
            gameSessionStatus: "active",
            gameIntroPresented: true,
            gameImageAutoGenerationEnabled: false,
            enableAgents: false,
            enableTools: false,
            gameWorldKit: parsed.kit,
            gameWorld: {
              seed: 7,
              generatorVersion: WORLD_GENERATOR_VERSION,
              grounding: "expand",
              brief: {
                briefVersion: 1,
                premise: "x",
                places: [],
                placeNames: [],
                groups: [],
                peopleNames: [],
                events: [],
              },
            },
          },
        })
      ).ok(),
    ).toBeTruthy();
    const drawn = page.waitForRequest((req) =>
      req.url().includes("/api/game-tile-packs/pack?id=local%2Fnight-meadows"),
    );
    await openGame(page, chatId);
    await expect(page.getByRole("region", { name: "Overworld", exact: true })).toBeVisible({ timeout: 40_000 });
    await drawn;
    await page.screenshot({ path: testInfo.outputPath("tile-packs-overworld.png") });

    // Removed: fantasy goes back to its own tiles.
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openRightPanel("agents");
    });
    await page.getByRole("button", { name: "Remove Night meadows", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByText("Fantasy, version 1", { exact: true })).toHaveCount(0);
    expect((await (await request.get("/api/game-tile-packs")).json()).selection).toEqual({});
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
    await request.delete("/api/game-tile-packs?id=local/night-meadows").catch(() => undefined);
  }
});

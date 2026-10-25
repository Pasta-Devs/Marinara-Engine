import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openGame, seedFight, withImports } from "./game-ruleset-fight-fixture.js";

/**
 * A party health widget follows the sheets (laptop playtest 2026-10-25: "Ulfgar HP" stayed at 50 while
 * the sheet said 48, because the Game Master wrote no widget tag). In an Ember Roads game Juno is down to
 * no Grit while the widget the setup wrote still says she is at full: on opening the game the row reads
 * what her sheet says, and the widget is saved so, for the Game Master's next turn too.
 */
test("a party health widget row follows the sheet without a widget tag", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"));
  doc.id = "ember-widget-health-e2e";
  await withImports(request, async (cleanup) => {
    const seeded = await seedFight(
      request,
      doc,
      { name: "Health widget", genre: "Fantasy", setting: "The road", tone: "Adventure" },
      {
        gameCharacterCards: [
          {
            name: "Juno",
            rulesetSheet: {
              v: 1,
              build: { abilities: { brawn: 1, wits: 3, heart: 0 }, fields: { toughness: 6 }, lists: {} },
            },
          },
        ],
        enableCustomWidgets: true,
        gameWidgetState: [
          {
            id: "party_health",
            type: "stat_block",
            label: "Party Health",
            position: "hud_left",
            config: {
              stats: [
                { name: "Juno HP", value: "99/99" },
                { name: "Juno Luck", value: 3 },
              ],
            },
          },
        ],
      },
      { juno: { pools: { grit: { value: 0 } } } },
      "The road is quiet, and Juno is bleeding.",
    );
    cleanup.push(seeded);
    await openGame(page, seeded.chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("Juno is bleeding", {
      timeout: 30_000,
    });
    const savedRows = async () => {
      const row = await (await request.get(`/api/chats/${seeded.chatId}`)).json();
      const metadata = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
      return (metadata.gameWidgetState?.[0]?.config?.stats ?? []) as Array<{ name: string; value: unknown }>;
    };
    await expect
      .poll(async () => (await savedRows()).find((stat) => stat.name === "Juno HP")?.value)
      .toMatch(/^0\/\d+$/);
    // Her Luck is not her health, and stays as it was.
    expect((await savedRows()).find((stat) => stat.name === "Juno Luck")?.value).toBe(3);
    await expect(page.getByText(/^0\/\d+$/).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: testInfo.outputPath("widget-health-sync.png") });
  });
});

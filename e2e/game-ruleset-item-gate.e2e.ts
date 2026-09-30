import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { inventoryButton } from "./game-inventory-fixture.js";
import { openGame, savedInventory, seedFight, withImports } from "./game-ruleset-fight-fixture.js";

/**
 * Item gates (#6892), on screen. In a Gravewatch game Ada reads a page of the vigil litany with the
 * Use button: with Nerve 1 she has to pass a Ward check first, which this copy of the page makes
 * one no single die can reach, so the page is used up for nothing; with Nerve 3 she reads it straight
 * through and gets her Resolve back.
 */

async function readPage(page: Page, request: APIRequestContext, nerve: number, id: string, shot?: string) {
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8"));
  doc.id = id;
  const kit = doc.catalogs.find((catalog: { id: string }) => catalog.id === "kit");
  // Thirty successes from one die: a check the reader cannot pass.
  kit.entries.find((entry: { id: string }) => entry.id === "litany-page").item.use.gate.difficulty = 30;
  const out = { line: "", resolve: "" };
  await withImports(request, async (cleanup) => {
    const seeded = await seedFight(
      request,
      doc,
      { name: "Litany", genre: "Gothic", setting: "The old plots", tone: "Grim" },
      {
        gameCharacterCards: [
          {
            name: "Ada",
            rulesetSheet: { v: 1, build: { abilities: { sinew: 2, nerve, warmth: 2 }, fields: {}, lists: {} } },
          },
        ],
        gameInventory: [{ id: "st-page", name: "Page of the vigil litany", quantity: 2, item: "kit/litany-page" }],
      },
      { ada: { pools: { resolve: { value: 0 } } } },
      "The lanterns gutter, and Ada's nerve with them.",
    );
    cleanup.push(seeded);
    let sent: string | null = null;
    await page.route("**/api/generate", async (route) => {
      sent = JSON.stringify(route.request().postDataJSON());
      await route.fulfill({ contentType: "text/event-stream", body: 'data: {"type":"done"}\n\n' });
    });
    await openGame(page, seeded.chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("lanterns gutter", {
      timeout: 30_000,
    });
    await inventoryButton(page).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Page of the vigil litany/ }).click();
    await expect(
      page.getByText(
        "needs a Ward check against 30 first unless Nerve is 3 or more, and a failed one uses it up for nothing",
        { exact: false },
      ),
    ).toBeVisible();
    if (shot) await page.screenshot({ path: shot, fullPage: true });
    const used = page.waitForResponse((r) => r.url().endsWith("/api/game/inventory/use"));
    await page.getByRole("button", { name: "Use", exact: true }).click();
    const answer = await used;
    expect(answer.ok(), await answer.text()).toBeTruthy();
    const line = ((await answer.json()) as { line: string }).line;
    await expect.poll(() => sent).toContain("[item_used]");
    // The request body is JSON, so the line is looked for as JSON writes it.
    expect(sent).toContain(JSON.stringify(line).slice(1, -1));
    out.line = line;
    // The page is used up either way.
    await expect
      .poll(
        async () => (await savedInventory(request, seeded.chatId)).find((stack) => stack.id === "st-page")?.quantity,
      )
      .toBe(1);
    const state = await (await request.get(`/api/chats/${seeded.chatId}/game-state`)).json();
    out.resolve = String(state.rulesetLive?.ada?.pools?.resolve?.value ?? "full");
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });
  return out;
}

test("a failed gate uses the page up for nothing", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const shot = testInfo.outputPath("ruleset-item-gate-details.png");
  const { line, resolve } = await readPage(page, request, 1, "gravewatch-gate-fail-e2e", shot);
  expect(line).toMatch(
    /^Ada uses Page of the vigil litany: Ward check \d+ against 30, failed; it is used up for nothing\. 1 left\.$/,
  );
  expect(resolve).toBe("0");
});

test("a reader steady enough skips the gate", async ({ page, request }) => {
  test.setTimeout(120_000);
  const { line, resolve } = await readPage(page, request, 3, "gravewatch-gate-skip-e2e");
  expect(line).toMatch(/^Ada uses Page of the vigil litany: restores 2 Resolve \(2\/\d+\)\. 1 left\.$/);
  expect(resolve).toBe("2");
});

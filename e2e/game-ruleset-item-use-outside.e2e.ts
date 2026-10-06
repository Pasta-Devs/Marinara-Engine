import { type APIRequestContext, expect, type Locator, type Page, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { inventoryButton } from "./game-inventory-fixture.js";
import { openGame, savedInventory, seedFight, withImports } from "./game-ruleset-fight-fixture.js";

/**
 * Using an item outside a fight (#6881), on screen. In an Ember Roads game Juno is down to no Grit and
 * carries two poultices: the Use button heals her with the Engine's dice before anything is said, takes
 * one out of the saved bag, and the message the Game Master gets says what happened in an
 * `[item_used]` block.
 */

test("the Use button heals with a poultice and tells the Game Master", async ({ page, request }, testInfo) => {
  test.setTimeout(120_000);
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"));
  doc.id = "ember-use-outside-e2e";
  await withImports(request, async (cleanup) => {
    const seeded = await seedFight(
      request,
      doc,
      { name: "Poultice", genre: "Fantasy", setting: "The road", tone: "Adventure" },
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
        gameInventory: [
          { id: "st-poultice", name: "Poultice", quantity: 2, item: "outfitter/poultice", holder: "Juno" },
        ],
      },
      { juno: { pools: { grit: { value: 0 } } } },
      "The road is quiet, and Juno is bleeding.",
    );
    cleanup.push(seeded);
    // The reply is not the point here: what the player's message carries is.
    let sent: string | null = null;
    await page.route("**/api/generate", async (route) => {
      sent = JSON.stringify(route.request().postDataJSON());
      await route.fulfill({ contentType: "text/event-stream", body: 'data: {"type":"done"}\n\n' });
    });
    await openGame(page, seeded.chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("Juno is bleeding", {
      timeout: 30_000,
    });
    await inventoryButton(page).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Poultice/ }).click();
    await page.screenshot({ path: testInfo.outputPath("ruleset-use-outside-before.png"), fullPage: true });
    const used = page.waitForResponse((r) => r.url().endsWith("/api/game/inventory/use"));
    await page.getByRole("button", { name: "Use", exact: true }).click();
    const answer = await used;
    expect(answer.ok(), await answer.text()).toBeTruthy();
    const body = (await answer.json()) as {
      line: string;
      rulesetLive: Record<string, { pools?: Record<string, { value: number }> }>;
    };
    expect(body.line).toMatch(/^Juno uses Poultice: heals [2-5] \(Grit [2-5]\/\d+\)\. 1 left\.$/);
    // The message says it, with the Engine's line in the block the Game Master reads.
    await expect.poll(() => sent).toContain("I use my Poultice.");
    expect(sent).toContain("[item_used]");
    // The request body is JSON, so the line is looked for as JSON writes it.
    expect(sent).toContain(JSON.stringify(body.line).slice(1, -1));
    // And it is written: one poultice left in the bag, and Juno's Grit back on the sheet.
    await expect
      .poll(
        async () =>
          (await savedInventory(request, seeded.chatId)).find((stack) => stack.id === "st-poultice")?.quantity,
      )
      .toBe(1);
    const state = await (await request.get(`/api/chats/${seeded.chatId}/game-state`)).json();
    expect(state.rulesetLive?.juno?.pools?.grit?.value).toBe(body.rulesetLive.juno?.pools?.grit?.value);
    expect(state.rulesetLive?.juno?.pools?.grit?.value).toBeGreaterThanOrEqual(2);
    // Saved as the player's message, the block shows as a badge with the Engine's line in the session log.
    const saved = await request.post(`/api/chats/${seeded.chatId}/messages`, {
      data: { role: "user", content: `I use my Poultice.\n\n[item_used]\n${body.line}\n[/item_used]` },
    });
    expect(saved.ok(), await saved.text()).toBeTruthy();
    await page.goto("/");
    await page.getByRole("button", { name: "Logs", exact: true }).click({ timeout: 30_000 });
    const logs = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Session Logs" }) });
    await expect(logs.getByText("🎒 Item used", { exact: true })).toBeVisible();
    await expect(logs.getByText(body.line)).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("ruleset-use-outside-after.png"), fullPage: true });
  });
});

test("while the ruleset's items are still loading, Use asks the Engine before saying it", async ({ page, request }) => {
  test.setTimeout(120_000);
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"));
  doc.id = "ember-use-loading-e2e";
  await withImports(request, async (cleanup) => {
    const seeded = await seedFight(
      request,
      doc,
      { name: "Arrows", genre: "Fantasy", setting: "The road", tone: "Adventure" },
      {
        gameCharacterCards: [
          {
            name: "Juno",
            rulesetSheet: { v: 1, build: { abilities: { brawn: 1, wits: 3, heart: 0 }, fields: {}, lists: {} } },
          },
        ],
        gameInventory: [{ id: "st-arrows", name: "Arrows", quantity: 4, item: "outfitter/arrows", holder: "Juno" }],
      },
      {},
      "The road is quiet.",
    );
    cleanup.push(seeded);
    // The catalogs never arrive, so the screen cannot tell whether arrows do anything when used.
    await page.route("**/api/capability-packages/rulesets/catalog**", () => new Promise<void>(() => {}));
    let sent: string | null = null;
    await page.route("**/api/generate", async (route) => {
      sent = JSON.stringify(route.request().postDataJSON());
      await route.fulfill({ contentType: "text/event-stream", body: 'data: {"type":"done"}\n\n' });
    });
    await openGame(page, seeded.chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("The road is quiet", {
      timeout: 30_000,
    });
    await inventoryButton(page).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Arrows/ }).click();
    const asked = page.waitForResponse((r) => r.url().endsWith("/api/game/inventory/use"));
    await page.getByRole("button", { name: "Use", exact: true }).click();
    const answer = await asked;
    expect(answer.status()).toBe(409);
    expect((await answer.json()).reason).toBe("no-use");
    // Arrows do nothing the Engine applies, so they are simply said, and nothing is spent.
    await expect.poll(() => sent).toContain("I use my Arrows.");
    expect(sent).not.toContain("[item_used]");
    expect((await savedInventory(request, seeded.chatId)).find((stack) => stack.id === "st-arrows")?.quantity).toBe(4);
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });
});

type UseAnswer = { rulesetLive: Record<string, { pools?: Record<string, { value: number }> }> };

/**
 * Juno with no Grit, two poultices and three apples, and a first Use whose answer is held until
 * `release` is called: it reaches the Engine at once, so the Engine applies it first. Nothing reads the
 * sheet back from the Engine meanwhile, so the sheet on screen is what the answers wrote.
 */
async function withHeldUse(
  page: Page,
  request: APIRequestContext,
  id: string,
  run: (juno: {
    use: () => Promise<void>;
    first: () => UseAnswer | null;
    release: () => void;
    said: () => number;
    grit: () => Locator;
  }) => Promise<void>,
): Promise<void> {
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/ember-roads.json", import.meta.url), "utf8"));
  doc.id = id;
  const character = await request.post("/api/characters", { data: { data: { name: "Juno" } } });
  expect(character.ok(), await character.text()).toBeTruthy();
  const characterId = ((await character.json()) as { id: string }).id;
  try {
    await withImports(request, async (cleanup) => {
      const seeded = await seedFight(
        request,
        doc,
        { name: "Two poultices", genre: "Fantasy", setting: "The road", tone: "Adventure" },
        {
          gamePartyCharacterIds: [characterId],
          gameCharacterCards: [
            {
              name: "Juno",
              rulesetSheet: {
                v: 1,
                build: { abilities: { brawn: 1, wits: 3, heart: 0 }, fields: { toughness: 6 }, lists: {} },
              },
            },
          ],
          gameInventory: [
            { id: "st-poultice", name: "Poultice", quantity: 2, item: "outfitter/poultice", holder: "Juno" },
            { id: "st-apple", name: "Apple", quantity: 3, holder: "Juno" },
          ],
        },
        { juno: { pools: { grit: { value: 0 } } } },
        "The road is quiet, and Juno is bleeding.",
      );
      cleanup.push(seeded);
      // Juno travels with the player, so her sheet opens from the party bar.
      const joined = await request.patch(`/api/chats/${seeded.chatId}`, { data: { characterIds: [characterId] } });
      expect(joined.ok(), await joined.text()).toBeTruthy();
      let said = 0;
      await page.route("**/api/generate", async (route) => {
        said += 1;
        await route.fulfill({ contentType: "text/event-stream", body: 'data: {"type":"done"}\n\n' });
      });
      await openGame(page, seeded.chatId);
      await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("Juno is bleeding", {
        timeout: 30_000,
      });
      await page.route(`**/api/chats/${seeded.chatId}/game-state*`, (route) =>
        route.request().method() === "GET" ? new Promise<void>(() => {}) : route.continue(),
      );
      let release!: () => void;
      const released = new Promise<void>((resolve) => (release = resolve));
      let first: UseAnswer | null = null;
      let calls = 0;
      await page.route("**/api/game/inventory/use", async (route) => {
        calls += 1;
        if (calls > 1) return route.continue();
        const response = await route.fetch();
        first = (await response.json()) as UseAnswer;
        await released;
        await route.fulfill({ response });
      });
      await run({
        use: async () => {
          await inventoryButton(page).click({ timeout: 30_000 });
          await page.getByRole("button", { name: /^Poultice/ }).click();
          await page.getByRole("button", { name: "Use", exact: true }).click();
        },
        first: () => first,
        release,
        said: () => said,
        grit: () => page.getByLabel("Grit for Juno", { exact: true }),
      });
      await page.unrouteAll({ behavior: "ignoreErrors" });
    });
  } finally {
    await request.delete(`/api/characters/${characterId}`);
  }
}

async function openJunoSheet(page: Page): Promise<void> {
  const portrait = page.getByTitle("Juno - Click to open character sheet", { exact: true }).filter({ visible: true });
  const members = page
    .locator('.mari-window-bubble[data-window="control:character-profiles"]')
    .filter({ visible: true });
  await expect(portrait.or(members).first()).toBeVisible({ timeout: 30_000 });
  if (await members.isVisible()) await members.click();
  await portrait.first().click();
}

test("an older Use answer arriving last never puts back the sheet a newer one wrote", async ({ page, request }) => {
  test.setTimeout(120_000);
  await withHeldUse(page, request, "ember-use-order-e2e", async (juno) => {
    await juno.use();
    await expect.poll(() => juno.first() !== null).toBe(true);
    const second = page.waitForResponse((r) => r.url().endsWith("/api/game/inventory/use"));
    await juno.use();
    const newer = (await (await second).json()) as UseAnswer;
    await expect.poll(juno.said).toBe(1);
    juno.release();
    // The older answer has been taken in once its message goes.
    await expect.poll(juno.said).toBe(2);
    const older = juno.first()!.rulesetLive.juno?.pools?.grit?.value;
    const latest = newer.rulesetLive.juno?.pools?.grit?.value;
    expect(latest).toBeGreaterThan(older ?? 0);
    await openJunoSheet(page);
    await expect(juno.grit()).toHaveValue(String(latest));
  });
});

test("a Use answer overtaken only by a plain inventory save still shows its sheet", async ({ page, request }) => {
  test.setTimeout(120_000);
  await withHeldUse(page, request, "ember-use-overtaken-e2e", async (juno) => {
    await juno.use();
    await expect.poll(() => juno.first() !== null).toBe(true);
    // An apple added while the use's answer is on its way: a save with no sheet in it, answered first.
    const saved = page.waitForResponse(
      (r) => r.url().endsWith("/api/game/inventory") && r.request().method() === "POST",
    );
    await inventoryButton(page).click({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Apple/ }).click();
    const amount = page.getByLabel("Apple amount", { exact: true });
    await amount.fill("+1");
    await amount.press("Enter");
    expect((await saved).ok()).toBeTruthy();
    await expect(page.getByRole("button", { name: /^Apple x4/ })).toBeVisible();
    juno.release();
    await expect.poll(juno.said).toBe(1);
    await page.getByRole("heading", { name: "Inventory", exact: true }).locator("xpath=../../button").click();
    await openJunoSheet(page);
    await expect(juno.grit()).toHaveValue(String(juno.first()!.rulesetLive.juno?.pools?.grit?.value));
  });
});

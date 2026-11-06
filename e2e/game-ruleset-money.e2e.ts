import { expect, test, type APIRequestContext } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { inventoryButton } from "./game-inventory-fixture.js";
import { openGame, savedInventory, withImports } from "./game-ruleset-fight-fixture.js";

/**
 * Money (#6901), on screen. A ruleset's coins are stacks in the bags: the purse line above them says
 * what they are worth, the picker's Coins list adds them, and the Game Master's pay and earn change them
 * on a real turn, with a notification each. Under a layer that takes a coin out, the purse and the
 * picker leave it out, and a price named in it is shown in the coins left.
 */

function gravewatch(id: string): string {
  const doc = JSON.parse(readFileSync(new URL("../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8"));
  doc.id = id;
  return JSON.stringify(doc);
}

/** A local model that answers every turn with the same reply. No paid provider is called. */
async function fakeModel(reply: string): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(async (incoming, response) => {
    for await (const _chunk of incoming) {
      // Drain the request.
    }
    if (incoming.method !== "POST") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
    const write = (delta: unknown, finishReason: string | null = null) =>
      response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`);
    write({ content: reply });
    write({}, "stop");
    response.end("data: [DONE]\n\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The model fixture did not bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}/v1` };
}

async function seedGame(
  request: APIRequestContext,
  rulesetId: string,
  options: Record<string, boolean>,
  inventory: unknown[],
  connectionId?: string,
): Promise<string> {
  const created = await request.post("/api/chats", {
    data: { name: "Money", mode: "game", characterIds: [], ...(connectionId ? { connectionId } : {}) },
  });
  expect(created.ok()).toBeTruthy();
  const chatId = ((await created.json()) as { id: string }).id;
  const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
    data: {
      gameId: `money-${chatId}`,
      gameSessionStatus: "active",
      gameIntroPresented: true,
      gameImageAutoGenerationEnabled: false,
      enableAgents: false,
      enableTools: false,
      gameRuleset: { id: rulesetId, version: 1, packageId: null, options },
      gameInventory: inventory,
    },
  });
  expect(meta.ok(), await meta.text()).toBeTruthy();
  const saved = await request.post(`/api/chats/${chatId}/messages`, {
    data: { role: "assistant", content: "The ferryman holds out a hand." },
  });
  expect(saved.ok()).toBeTruthy();
  return chatId;
}

const coinsOf = async (request: APIRequestContext, chatId: string) =>
  (await savedInventory(request, chatId)).map((stack) => `${stack.name} <${stack.item}> ${stack.quantity}`);

test("coins show their worth, are picked from the Coins list, and the Game Master's pay and earn change them", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const model = await fakeModel(
    'She takes the fare. [inventory: action="pay" amount="3 shillings"] [inventory: action="earn" amount="2 pennies"]',
  );
  let connectionId = "";
  try {
    await withImports(request, async (cleanup) => {
      const imported = await request.post("/api/game-rulesets/import", {
        data: { definition: gravewatch("gravewatch-money-e2e") },
      });
      expect(imported.ok(), await imported.text()).toBeTruthy();
      const rulesetId = (await imported.json()).rulesetId as string;
      const connection = await request.post("/api/connections", {
        data: {
          name: "Local money fixture",
          provider: "custom",
          baseUrl: model.baseUrl,
          apiKey: "synthetic-test-key",
          model: "money-fixture",
          maxContext: 32768,
          treatAsLocalEndpoint: true,
        },
      });
      expect(connection.ok()).toBeTruthy();
      connectionId = (await connection.json()).id;
      const chatId = await seedGame(
        request,
        rulesetId,
        {},
        [
          { id: "st-crowns", name: "crowns", item: "coin:crown", quantity: 1 },
          { id: "st-pennies", name: "pennies", item: "coin:penny", quantity: 12 },
        ],
        connectionId,
      );
      cleanup.push({ chatId, rulesetId, anchor: "" });
      await openGame(page, chatId);
      await inventoryButton(page).click({ timeout: 30_000 });

      // What the coins in view are worth, in the family's smallest coin.
      await expect(page.getByText("Coin: crowns x1, pennies x12 (worth 72 pennies)", { exact: true })).toBeVisible();

      // Escape over the picker closes only the picker, not the inventory beneath it.
      const inventory = page.getByRole("dialog", { name: "Inventory", exact: true });
      const picker = page.getByRole("dialog", { name: "Add items from the ruleset" });
      await page.getByRole("button", { name: "From the ruleset", exact: true }).click();
      await expect(picker).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(picker).toBeHidden();
      await expect(inventory).toBeVisible();

      // The picker offers the coins as one more list.
      await page.getByRole("button", { name: "From the ruleset", exact: true }).click();
      await picker.getByRole("combobox", { name: "Catalog", exact: true }).selectOption({ label: "Coins" });
      await expect(picker.getByRole("checkbox")).toHaveCount(3);
      await picker.getByRole("checkbox", { name: "shillings", exact: true }).check();
      await picker.getByRole("button", { name: "Add 1 item", exact: true }).click();
      await expect(picker).toBeHidden();
      await expect(
        page.getByText("Coin: crowns x1, shillings x1, pennies x12 (worth 84 pennies)", { exact: true }),
      ).toBeVisible();
      await expect
        .poll(() => coinsOf(request, chatId))
        .toEqual(["crowns <coin:crown> 1", "pennies <coin:penny> 12", "shillings <coin:shilling> 1"]);
      await page.screenshot({ path: testInfo.outputPath("money-purse.png") });
      // Escape closes the inventory, and so does its X.
      await page.keyboard.press("Escape");
      await expect(inventory).toBeHidden();
      await inventoryButton(page).click();
      await expect(inventory).toBeVisible();
      await page.getByRole("button", { name: "Close inventory", exact: true }).click();
      await expect(inventory).toBeHidden();

      // A turn: the Game Master charges 3 shillings and gives 2 pennies back.
      await page.getByPlaceholder("What do you do?", { exact: true }).fill("I pay the ferryman.");
      await page.getByRole("button", { name: "Send game turn", exact: true }).click();
      // Both toasts waited for at once: waited for one after the other, the second can come and go while
      // the first is still awaited on a busy machine. The coins below are what was paid and earned.
      await Promise.all([
        expect(page.getByText("You paid shillings x3.", { exact: true })).toBeVisible({ timeout: 30_000 }),
        expect(page.getByText("You gained pennies x2!", { exact: true })).toBeVisible({ timeout: 30_000 }),
      ]);
      // Paid with the crown, the shilling and the pennies, and 4 shillings came back.
      await expect
        .poll(() => coinsOf(request, chatId))
        .toEqual(["shillings <coin:shilling> 4", "pennies <coin:penny> 2"]);
      await inventoryButton(page).click();
      await expect(page.getByText("Coin: shillings x4, pennies x2 (worth 50 pennies)", { exact: true })).toBeVisible();
    });
  } finally {
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    model.server.closeAllConnections();
    await new Promise<void>((resolve) => model.server.close(() => resolve()));
  }
});

test("a layer that takes a coin out leaves it out of the purse and the picker, and prices it in the coins left", async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  await withImports(request, async (cleanup) => {
    const imported = await request.post("/api/game-rulesets/import", {
      data: { definition: gravewatch("gravewatch-night-e2e") },
    });
    expect(imported.ok(), await imported.text()).toBeTruthy();
    const rulesetId = (await imported.json()).rulesetId as string;
    const chatId = await seedGame(request, rulesetId, { "layer.long_night": true }, [
      { id: "st-crowns", name: "crowns", item: "coin:crown", quantity: 2 },
      { id: "st-shillings", name: "shillings", item: "coin:shilling", quantity: 1 },
    ]);
    cleanup.push({ chatId, rulesetId, anchor: "" });
    await openGame(page, chatId);
    await inventoryButton(page).click({ timeout: 30_000 });
    // Crowns already held stay in the bag, but no longer count.
    await expect(page.getByRole("button", { name: "crowns x2", exact: true })).toBeVisible();
    await expect(page.getByText("Coin: shillings x1 (worth 12 pennies)", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "From the ruleset", exact: true }).click();
    const picker = page.getByRole("dialog", { name: "Add items from the ruleset" });
    // A watch pistol costs 3 crowns; in the long night that is 15 shillings.
    await picker.getByRole("searchbox").fill("watch pistol");
    await expect(picker.getByText("Price in shillings: 15", { exact: true })).toBeVisible();
    await picker.getByRole("searchbox").fill("");
    await picker.getByRole("combobox", { name: "Catalog", exact: true }).selectOption({ label: "Coins" });
    await expect(picker.getByRole("checkbox")).toHaveCount(2);
    await expect(picker.getByRole("checkbox", { name: "crowns", exact: true })).toHaveCount(0);
  });
});

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { WORLD_GENERATOR_VERSION, WORLD_STARTER_KITS, compileGameWorld, parseWorldKit } from "@marinara-engine/shared";
import { openGame } from "./game-ruleset-fight-fixture.js";
import { openChatTool } from "./chat-settings-tools.js";

/**
 * The town (worldgen W8b), on screen: from the overworld the party enters the settlement it is in, walks
 * across town to a place there, the minutes pass on the clock, the next turn tells the Game Master, and
 * the party leaves back to the overworld.
 */

/** A local model that answers every turn the same, and keeps every prompt it was sent. */
async function fakeModel(reply: string): Promise<{ server: Server; baseUrl: string; prompts: string[] }> {
  const prompts: string[] = [];
  const server = createServer(async (incoming, response) => {
    let body = "";
    for await (const chunk of incoming) body += chunk;
    if (incoming.method !== "POST") {
      response.writeHead(404).end();
      return;
    }
    prompts.push(body);
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
  return { server, baseUrl: `http://127.0.0.1:${address.port}/v1`, prompts };
}

const parsedKit = parseWorldKit(WORLD_STARTER_KITS.find((kit) => kit.id === "high_fantasy")!);
if (!parsedKit.ok) throw new Error("The high fantasy kit does not read");
const kit = parsedKit.kit;
const brief = {
  briefVersion: 1 as const,
  premise: "The old king is dying and the river provinces quarrel over the succession.",
  places: [
    { name: "Aldmark", layer: "realm", tags: [] },
    { name: "The Fenlands", layer: "province", parent: "Aldmark", tags: [] },
    { name: "Hollin", layer: "settlement", parent: "The Fenlands", size: "village", tags: [], start: true as const },
    { name: "Thornmere", layer: "settlement", parent: "The Fenlands", size: "city", tags: ["port"] },
  ],
  placeNames: [{ culture: kit.cultures[0]!.id, names: ["Ashby", "Wending", "Calder", "Ravel", "Brennock", "Sallow"] }],
  groups: [],
  peopleNames: [] as Array<{ culture: string; given: string[]; family: string[]; order: "given-family" }>,
  events: [],
};
const gameWorld = { seed: 20261002, generatorVersion: WORLD_GENERATOR_VERSION, grounding: "expand" as const, brief };

async function metadataOf(request: APIRequestContext, chatId: string) {
  const row = await (await request.get(`/api/chats/${chatId}`)).json();
  return (typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata) as Record<string, any>;
}

/** On a phone the toolbar's buttons sit in the game's actions menu. */
/** A button in the Game controls window, opened from its bubble (or the phone's Chat tools menu). */
async function toolbarButton(page: Page, name: string) {
  const controls = page.locator('.mari-window[data-window="control:game"]');
  // The window may already be open from an earlier click, and then its bubble is not shown.
  await expect(
    page
      .locator(
        '.mari-window[data-window="control:game"], .mari-window-bubble[data-window="control:game"], [data-chat-tools-menu-button]',
      )
      .first(),
  ).toBeVisible({ timeout: 40_000 });
  if (!(await controls.isVisible())) await openChatTool(page, "control:game");
  return controls.getByRole("button", { name, exact: true });
}

test("the party enters the town it is in, walks across it, and the next turn tells where", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const model = await fakeModel("The market is loud with gulls.");
  let connectionId = "";
  let chatId = "";
  try {
    const connection = await request.post("/api/connections", {
      data: {
        name: "Local town fixture",
        provider: "custom",
        baseUrl: model.baseUrl,
        apiKey: "synthetic-test-key",
        model: "town-fixture",
        maxContext: 32768,
        treatAsLocalEndpoint: true,
      },
    });
    expect(connection.ok()).toBeTruthy();
    connectionId = (await connection.json()).id;
    const created = await request.post("/api/chats", {
      data: { name: "Town", mode: "game", characterIds: [], connectionId },
    });
    expect(created.ok()).toBeTruthy();
    chatId = ((await created.json()) as { id: string }).id;
    const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameId: `town-${chatId}`,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
        enableAgents: false,
        enableTools: false,
        gameWorldKit: kit,
        gameWorld,
        gameTime: { day: 1, hour: 10, minute: 0 },
      },
    });
    expect(meta.ok(), await meta.text()).toBeTruthy();
    // The party is in Thornmere, the city.
    expect(
      (
        await request.post(`/api/chats/${chatId}/messages`, {
          data: { role: "assistant", content: 'The gates of Thornmere. [place: name="Thornmere" result="ok"]' },
        })
      ).ok(),
    ).toBeTruthy();
    await openGame(page, chatId);
    await expect(page.getByRole("region", { name: "Overworld", exact: true })).toBeVisible({ timeout: 40_000 });

    // Enter the town from the party's own settlement on the map.
    await page.getByRole("button", { name: /^Thornmere, .*: the party is here$/u }).click();
    await page.getByRole("button", { name: "Enter Thornmere", exact: true }).click();
    await expect(page.getByRole("region", { name: "Town", exact: true })).toBeVisible();
    await expect.poll(async () => (await metadataOf(request, chatId)).gameWorldView).toBe("town");
    await expect(page.getByRole("button", { name: "The square: the party is here", exact: true })).toBeAttached();

    // Walk to a place in town from the list: the minutes pass and the party stands there.
    await page.getByRole("button", { name: "Places in town", exact: true }).click();
    const list = page.getByRole("list", { name: "Places in town" });
    const target = list.getByRole("button").nth(1);
    const title = ((await target.locator("span").first().textContent()) ?? "").trim();
    await target.click();
    const card = page.locator('[data-component="TownView.Card"]');
    await expect(card).toContainText(title);
    await expect(card).toContainText(/minutes? away/u);
    await page.screenshot({ path: testInfo.outputPath("town-card.png") });
    await card.getByRole("button", { name: "Walk there", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: `Walked to ${title}.` })).toBeVisible({ timeout: 20_000 });
    const walked = await metadataOf(request, chatId);
    expect(walked.gameTownVisit).toBeTruthy();
    expect(walked.gameTime.hour * 60 + walked.gameTime.minute).toBeGreaterThan(10 * 60);
    await page.screenshot({ path: testInfo.outputPath("town-walked.png") });

    // The next turn tells the Game Master where in town the party went.
    await page.getByPlaceholder("What do you do?", { exact: true }).fill("We look around.");
    await page.getByRole("button", { name: "Send game turn", exact: true }).click();
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText(
      "The market is loud with gulls.",
      { timeout: 30_000 },
    );
    expect(model.prompts.find((body) => body.includes("We look around."))).toContain(
      "In Thornmere, the party has walked to",
    );
    await expect.poll(async () => (await metadataOf(request, chatId)).gameTownVisit ?? null).toBeNull();

    // The scene view and back returns to the town, not the overworld. On a phone the Game controls sheet
    // covers the view (and Leave town), so a switch closes it back to the Chat tools button; a computer's
    // window stays open.
    const controls = page.locator('.mari-window[data-window="control:game"]');
    const phone = await page.evaluate(() => matchMedia("(max-width: 767px)").matches);
    const expectControlsAfterSwitch = async () => {
      if (!phone) return expect(controls).toBeVisible();
      await expect(controls).toHaveCount(0);
      await expect(page.locator("[data-chat-tools-menu-button]")).toBeFocused();
    };
    await (await toolbarButton(page, "Show the scene")).click();
    await expect(page.getByRole("region", { name: "Town", exact: true })).toBeHidden();
    await expectControlsAfterSwitch();
    if (!phone) {
      await controls.getByRole("button", { name: "Pin window", exact: true }).click();
      await expect(controls).toHaveAttribute("data-pinned", "true");
    }
    await (await toolbarButton(page, "Show the overworld")).click();
    await expect(page.getByRole("region", { name: "Town", exact: true })).toBeVisible();
    await expectControlsAfterSwitch();
    if (!phone) await expect(controls).toHaveAttribute("data-pinned", "true");

    // Leave back to the overworld.
    await page.getByRole("button", { name: "Leave town", exact: true }).click();
    await expect(page.getByRole("region", { name: "Overworld", exact: true })).toBeVisible();
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    model.server.closeAllConnections();
    await new Promise<void>((resolve) => model.server.close(() => resolve()));
  }
});

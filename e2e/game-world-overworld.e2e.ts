import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import {
  WORLD_GENERATOR_VERSION,
  WORLD_STARTER_KITS,
  compileGameWorld,
  parseWorldKit,
  worldRoute,
} from "@marinara-engine/shared";
import { openGame } from "./game-ruleset-fight-fixture.js";
import { chatSettingsWindow, openChatTool } from "./chat-settings-tools.js";

/**
 * The overworld (worldgen W8), on screen: a game with a world opens on it; the party walks along the
 * world's ways from the Places list or the map, the walk's days pass on the clock, and the next turn tells
 * the Game Master. The scene view is a switch away.
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
const world = compileGameWorld({ kit, seed: gameWorld.seed, grounding: "expand", brief });
const hollin = world.places.find((place) => place.name === "Hollin")!;
const thornmere = world.places.find((place) => place.name === "Thornmere")!;
const trip = worldRoute(world, hollin.id, thornmere.id)!;

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

test("a world game opens on the overworld, and a walk moves the party and the clock and is told next turn", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const model = await fakeModel("The gates of the river port stand open.");
  let connectionId = "";
  let chatId = "";
  try {
    const connection = await request.post("/api/connections", {
      data: {
        name: "Local overworld fixture",
        provider: "custom",
        baseUrl: model.baseUrl,
        apiKey: "synthetic-test-key",
        model: "overworld-fixture",
        maxContext: 32768,
        treatAsLocalEndpoint: true,
      },
    });
    expect(connection.ok()).toBeTruthy();
    connectionId = (await connection.json()).id;
    const created = await request.post("/api/chats", {
      data: { name: "Overworld", mode: "game", characterIds: [], connectionId },
    });
    expect(created.ok()).toBeTruthy();
    chatId = ((await created.json()) as { id: string }).id;
    const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameId: `overworld-${chatId}`,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
        enableAgents: false,
        enableTools: false,
        gameWorldKit: kit,
        gameWorld,
        gameTime: { day: 1, hour: 8, minute: 0 },
      },
    });
    expect(meta.ok(), await meta.text()).toBeTruthy();
    expect(
      (
        await request.post(`/api/chats/${chatId}/messages`, {
          data: { role: "assistant", content: "Mist lies on the reeds around Hollin." },
        })
      ).ok(),
    ).toBeTruthy();
    await openGame(page, chatId);

    // The overworld is the first view, with the party where the world starts it, under the narration.
    const overworld = page.getByRole("region", { name: "Overworld", exact: true });
    await expect(overworld).toBeVisible({ timeout: 40_000 });
    await expect(page.getByRole("button", { name: /^Hollin, .*: the party is here$/u })).toBeAttached();
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText(
      "Mist lies on the reeds around Hollin.",
      { timeout: 30_000 },
    );

    // A settlement on the map itself takes a click through the narration's empty space.
    const card = page.locator('[data-component="WorldOverworld.Card"]');
    await page.getByRole("button", { name: /^Hollin, .*: the party is here$/u }).click();
    await expect(card).toContainText("The party is here.");
    await card.getByRole("button", { name: "Close", exact: true }).click();
    await expect(card).toHaveCount(0);

    // Places, nearest first: Thornmere, with its days on the way.
    await page.getByRole("button", { name: "Places", exact: true }).click();
    const places = page.getByRole("list", { name: "Places" });
    await expect(places.getByRole("button").first()).toContainText("Hollin");
    await places.getByRole("button", { name: /^Thornmere/u }).click();
    await expect(card).toContainText("Thornmere");
    await expect(card).toContainText(trip.days < 1 ? /hours? on the way/u : /days? on the way/u);
    await page.screenshot({ path: testInfo.outputPath("overworld-card.png") });

    // The walk: the party is there, the clock has passed the trip, and the next turn will tell it.
    await card.getByRole("button", { name: "Walk there", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Walked to Thornmere." })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /^Thornmere, .*: the party is here$/u })).toBeAttached();
    const walked = await metadataOf(request, chatId);
    expect(walked.gameWorldWalk).toMatchObject({ from: hollin.id, to: thornmere.id });
    const minutes = (time: { day: number; hour: number; minute: number }) =>
      (time.day * 24 + time.hour) * 60 + time.minute;
    expect(minutes(walked.gameTime) - minutes({ day: 1, hour: 8, minute: 0 })).toBeGreaterThanOrEqual(
      Math.round(trip.days * 24 * 60),
    );
    await page.screenshot({ path: testInfo.outputPath("overworld-walked.png") });

    // The next turn tells the Game Master, and the walk is no longer pending.
    await page.getByPlaceholder("What do you do?", { exact: true }).fill("We look for an inn.");
    await page.getByRole("button", { name: "Send game turn", exact: true }).click();
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText(
      "The gates of the river port stand open.",
      { timeout: 30_000 },
    );
    const told = model.prompts.find((body) => body.includes("We look for an inn."))!;
    expect(told).toContain("On the overworld, the party has travelled from Hollin to Thornmere");
    expect(told).toContain("The party is in Thornmere");
    await expect.poll(async () => (await metadataOf(request, chatId)).gameWorldWalk ?? null).toBeNull();
    // The reply's tags never show as narration.
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).not.toContainText("[place:");
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).not.toContainText("[world:");

    // The scene view is a switch away, and the game remembers the choice.
    await (await toolbarButton(page, "Show the scene")).click();
    await expect(overworld).toBeHidden();
    await expect.poll(async () => (await metadataOf(request, chatId)).gameWorldView).toBe("scene");
    await (await toolbarButton(page, "Show the overworld")).click();
    await expect(page.getByRole("region", { name: "Overworld", exact: true })).toBeVisible();

    // On a phone, with Game controls put back in Chat Settings, a switch closes the Chat Settings sheet.
    if (await page.evaluate(() => matchMedia("(max-width: 767px)").matches)) {
      const controls = await openChatTool(page, "control:game");
      await controls.locator('[data-window-control="put-back"]').click();
      const settings = chatSettingsWindow(page);
      await settings
        .locator('[data-docked-chat-control="control:game"]')
        .getByRole("button", { name: "Show the scene", exact: true })
        .click();
      await expect(overworld).toBeHidden();
      await expect(settings).toHaveCount(0);
    }
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    model.server.closeAllConnections();
    await new Promise<void>((resolve) => model.server.close(() => resolve()));
  }
});

test("a game without a world has no overworld", async ({ page, request }) => {
  test.setTimeout(90_000);
  const created = await request.post("/api/chats", { data: { name: "No world", mode: "game", characterIds: [] } });
  expect(created.ok()).toBeTruthy();
  const chatId = ((await created.json()) as { id: string }).id;
  try {
    const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameId: `no-world-${chatId}`,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
        enableAgents: false,
        enableTools: false,
      },
    });
    expect(meta.ok()).toBeTruthy();
    await request.post(`/api/chats/${chatId}/messages`, { data: { role: "assistant", content: "Rain." } });
    await openGame(page, chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("Rain.", {
      timeout: 40_000,
    });
    await expect(page.getByRole("region", { name: "Overworld", exact: true })).toHaveCount(0);
    await expect(await toolbarButton(page, "Show the overworld")).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
  }
});

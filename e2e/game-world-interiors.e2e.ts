import { expect, test } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { WORLD_GENERATOR_VERSION, WORLD_STARTER_KITS, compileGameWorld, parseWorldKit } from "@marinara-engine/shared";
import { openGame } from "./game-ruleset-fight-fixture.js";

/**
 * Inside buildings (worldgen W13), on screen: in town the party walks to a workplace, goes inside, sees
 * its rooms and the people at work there, looks at one of them, and goes back outside; a district has
 * no way in; the next turn tells the Game Master what is inside.
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

test("the party goes inside a building it walked to, and the next turn tells what is inside", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const model = await fakeModel("Steam rises from the kettles.");
  let connectionId = "";
  let chatId = "";
  try {
    const connection = await request.post("/api/connections", {
      data: {
        name: "Local rooms fixture",
        provider: "custom",
        baseUrl: model.baseUrl,
        apiKey: "synthetic-test-key",
        model: "rooms-fixture",
        maxContext: 32768,
        treatAsLocalEndpoint: true,
      },
    });
    expect(connection.ok()).toBeTruthy();
    connectionId = (await connection.json()).id;
    const created = await request.post("/api/chats", {
      data: { name: "Rooms", mode: "game", characterIds: [], connectionId },
    });
    expect(created.ok()).toBeTruthy();
    chatId = ((await created.json()) as { id: string }).id;
    const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameId: `rooms-${chatId}`,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
        enableAgents: false,
        enableTools: false,
        gameWorldKit: kit,
        gameWorld,
        gameTime: { day: 1, hour: 10, minute: 0 },
        gameWorldView: "town",
      },
    });
    expect(meta.ok(), await meta.text()).toBeTruthy();
    expect(
      (
        await request.post(`/api/chats/${chatId}/messages`, {
          data: { role: "assistant", content: 'The gates of Thornmere. [place: name="Thornmere" result="ok"]' },
        })
      ).ok(),
    ).toBeTruthy();
    await openGame(page, chatId);
    await expect(page.getByRole("region", { name: "Town", exact: true })).toBeVisible({ timeout: 40_000 });

    // Walk to a workplace from the list.
    await page.getByRole("button", { name: "Places in town", exact: true }).click();
    const list = page.getByRole("list", { name: "Places in town" });
    const target = list
      .getByRole("button")
      .filter({ hasText: /^Workplace/u })
      .first();
    const title = ((await target.locator("span").first().textContent()) ?? "").trim();
    await target.click();
    const card = page.locator('[data-component="TownView.Card"]');
    await expect(card.getByRole("button", { name: "Go inside", exact: true })).toHaveCount(0);
    await card.getByRole("button", { name: "Walk there", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: `Walked to ${title}.` })).toBeVisible({ timeout: 20_000 });

    // The party is at the door: go inside.
    await page.getByRole("button", { name: `${title}: the party is here`, exact: true }).click({ force: true });
    await card.getByRole("button", { name: "Go inside", exact: true }).click();
    const inside = page.getByRole("region", { name: "Inside a building", exact: true });
    await expect(inside).toBeVisible();
    await expect(page.getByText(`Inside ${title}, Thornmere`, { exact: true })).toBeVisible();
    // The people at work there at ten in the morning, one of them looked at.
    const people = inside.getByRole("button");
    await expect(people.first()).toBeAttached();
    // Not forced: the people are placed once the rooms are measured, a frame after they mount (later on CI WebKit),
    // and until then they sit outside the region. The click waits for that.
    await people.first().click();
    const personCard = page.locator('[data-component="TownInterior.Card"]');
    await expect(personCard).toContainText("Here, awake");
    await page.screenshot({ path: testInfo.outputPath("inside.png") });

    // Back outside, to the street.
    await page.getByRole("button", { name: "Go outside", exact: true }).click();
    await expect(inside).toBeHidden();
    await expect(page.getByRole("region", { name: "Town", exact: true })).toBeVisible();

    // The next turn tells the Game Master what is inside.
    await page.getByPlaceholder("What do you do?", { exact: true }).fill("We step in.");
    await page.getByRole("button", { name: "Send game turn", exact: true }).click();
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText(
      "Steam rises from the kettles.",
      { timeout: 30_000 },
    );
    const told = model.prompts.find((body) => body.includes("We step in.")) ?? "";
    expect(told).toContain("In Thornmere, the party has walked to");
    expect(told).toMatch(/Inside: (a front room|one room) with /u);
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    model.server.closeAllConnections();
    await new Promise<void>((resolve) => model.server.close(() => resolve()));
  }
});

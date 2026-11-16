import { expect, test, type APIRequestContext } from "@playwright/test";
import { createServer, type Server } from "node:http";
import {
  DUNGEON_EXIT_PROP,
  dungeonFromGameDungeonMap,
  dungeonPath,
  dungeonWalkable,
  gameDungeonMapFromDungeon,
  generateDungeonMap,
} from "@marinara-engine/shared";
import { openGame } from "./game-ruleset-fight-fixture.js";

/**
 * A dungeon map on screen: the Game Master's [map:] opens it over the scene, a click walks the party by
 * the shortest way and the next turn tells it, the toggle shows the scene and the map again, and from
 * the way out the party leaves.
 */

async function fakeModel(replies: string[]): Promise<{ server: Server; baseUrl: string; prompts: string[] }> {
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
    write({ content: replies.shift() ?? "Silence." });
    write({}, "stop");
    response.end("data: [DONE]\n\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The model fixture did not bind");
  return { server, baseUrl: `http://127.0.0.1:${address.port}/v1`, prompts };
}

async function metadataOf(request: APIRequestContext, chatId: string) {
  const row = await (await request.get(`/api/chats/${chatId}`)).json();
  return (typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata) as Record<string, any>;
}

test("the Game Master opens a crypt, the party walks it, and leaves by the way out", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(240_000);
  const model = await fakeModel([
    'You descend the worn steps. [map: kind="dungeon" set="dungeon_crypt" name="The Old Crypt"]',
    "Dust settles behind you.",
  ]);
  let connectionId = "";
  let chatId = "";
  try {
    const connection = await request.post("/api/connections", {
      data: {
        name: "Local dungeon fixture",
        provider: "custom",
        baseUrl: model.baseUrl,
        apiKey: "synthetic-test-key",
        model: "dungeon-fixture",
        maxContext: 32768,
        treatAsLocalEndpoint: true,
      },
    });
    expect(connection.ok()).toBeTruthy();
    connectionId = (await connection.json()).id;
    const created = await request.post("/api/chats", {
      data: { name: "Crypt", mode: "game", characterIds: [], connectionId },
    });
    expect(created.ok()).toBeTruthy();
    chatId = ((await created.json()) as { id: string }).id;
    const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
      data: {
        gameId: `crypt-${chatId}`,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        // Dungeon maps are the Overworld RPG's.
        gameStyle: "overworld",
        gameImageAutoGenerationEnabled: false,
        enableAgents: false,
        enableTools: false,
        gameTime: { day: 1, hour: 9, minute: 0 },
      },
    });
    expect(meta.ok(), await meta.text()).toBeTruthy();
    await request.post(`/api/chats/${chatId}/messages`, {
      data: { role: "assistant", content: "A chapel, and a stair going down." },
    });
    await openGame(page, chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("A chapel", {
      timeout: 30_000,
    });

    // The Game Master opens the crypt.
    await page.getByPlaceholder("What do you do?", { exact: true }).fill("We go down.");
    await page.getByRole("button", { name: "Send game turn", exact: true }).click();
    const view = page.locator('[data-component="DungeonMapView"]');
    await expect(view).toBeVisible({ timeout: 30_000 });
    await expect(view).toHaveAttribute("data-tiles", /plain|image/);
    const kept = (await metadataOf(request, chatId)).gameDungeonMap;
    expect(kept.name).toBe("The Old Crypt");
    expect(kept.set).toBe("dungeon_crypt");
    // The map the Engine made is the one the seed makes (nothing random on the way).
    const cells = dungeonFromGameDungeonMap(kept);
    // A crypt is laid out to a plan (building plans): its levels and rooms by name, the way in in its hall.
    await expect(page.getByRole("status").filter({ hasText: /The Old Crypt · .+ · in the hall/u })).toBeVisible();
    const leave = page.getByRole("button", { name: "Leave by the stairs", exact: true });
    await expect(leave).toBeVisible();

    // A click on a cell in the last room the party can reach (a locked one waits for its key) walks there.
    let goal: { x: number; y: number } | null = null;
    for (const room of [...kept.rooms].reverse()) {
      for (let y = room.y; y < room.y + room.h && !goal; y++)
        for (let x = room.x; x < room.x + room.w; x++)
          if (dungeonWalkable(cells, x, y) && dungeonPath(cells, kept.at, { x, y })) {
            goal = { x, y };
            break;
          }
      if (goal) break;
    }
    expect(goal).not.toBeNull();
    const click = async (cell: { x: number; y: number }) => {
      // The view follows the party once its walk is drawn, so the next cell is read off where it stands.
      await expect(view).toHaveAttribute("data-walking", "false");
      const scale = Number(await view.getAttribute("data-scale"));
      const [camX, camY] = (await view.getAttribute("data-camera"))!.split(",").map(Number) as [number, number];
      const x = (cell.x * 16 + 8) * scale - camX;
      const y = (cell.y * 16 + 8) * scale - camY;
      const walked = page.waitForResponse((response) => response.url().includes("/map/walk"));
      await view.locator("canvas").click({ position: { x, y } });
      return (await walked).json();
    };
    // A few cells at a time, so the next one is always on screen (the view follows the party).
    let here = kept.at;
    const walkTo = async (target: { x: number; y: number }) => {
      while (here.x !== target.x || here.y !== target.y) {
        const path = dungeonPath(cells, here, target)!;
        // As far along the way as is on screen now (the view follows the party).
        await expect(view).toHaveAttribute("data-walking", "false");
        await expect(view).toHaveAttribute("data-can-walk", "true", { timeout: 30_000 });
        const scale = Number(await view.getAttribute("data-scale"));
        const [camX, camY] = (await view.getAttribute("data-camera"))!.split(",").map(Number) as [number, number];
        // Only cells the canvas itself answers for: the composer, minimap and toolbar sit over its edges.
        const points = path.map((cell) => [(cell.x * 16 + 8) * scale - camX, (cell.y * 16 + 8) * scale - camY]);
        const open = await view.locator("canvas").evaluate((canvas, list) => {
          const rect = canvas.getBoundingClientRect();
          return list.map(([x, y]) => {
            if (x! < 8 || y! < 8 || x! > rect.width - 8 || y! > rect.height - 8) return false;
            return document.elementFromPoint(rect.left + x!, rect.top + y!) === canvas;
          });
        }, points);
        const index = open.lastIndexOf(true);
        expect(index, "some cell along the way is clickable").toBeGreaterThanOrEqual(0);
        const step = path[index]!;
        const answer = await click(step);
        expect(answer.map.at).toEqual(step);
        here = step;
        await expect(page.locator('[data-component="DungeonMapView"]')).toHaveAttribute("data-camera", /\d/u);
      }
    };
    await walkTo(goal!);
    await expect.poll(async () => (await metadataOf(request, chatId)).gameDungeonMap.at).toEqual(goal);
    await expect(leave).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("dungeon-crypt.png") });

    // The next turn tells the walk.
    await page.getByPlaceholder("What do you do?", { exact: true }).fill("We look around.");
    await page.getByRole("button", { name: "Send game turn", exact: true }).click();
    await expect.poll(() => model.prompts.some((body) => body.includes("The party walked from"))).toBe(true);
    await expect.poll(async () => (await metadataOf(request, chatId)).gameDungeonWalk).toBeNull();

    // Back to the way out, and out.
    const exit = kept.entrance;
    expect(cells.props[exit.y * cells.width + exit.x]).toBe(DUNGEON_EXIT_PROP);
    await walkTo(exit);
    await expect(leave).toBeVisible();
    await leave.click();
    await expect(view).toHaveCount(0);
    await expect.poll(async () => (await metadataOf(request, chatId)).gameDungeonMap).toBeNull();
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
    model.server.closeAllConnections();
    await new Promise<void>((resolve) => model.server.close(() => resolve()));
  }
});

test("a game with no map shows no map toggle and plays as before", async ({ page, request }, testInfo) => {
  const created = await request.post("/api/chats", { data: { name: "No map", mode: "game", characterIds: [] } });
  const chatId = ((await created.json()) as { id: string }).id;
  try {
    await request.patch(`/api/chats/${chatId}/metadata`, {
      data: { gameId: `nomap-${chatId}`, gameSessionStatus: "active", gameIntroPresented: true },
    });
    await request.post(`/api/chats/${chatId}/messages`, { data: { role: "assistant", content: "A quiet road." } });
    await openGame(page, chatId);
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("A quiet road.", {
      timeout: 30_000,
    });
    await expect(page.locator('[data-component="DungeonMapView"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show the map", exact: true })).toHaveCount(0);
    // A map kept as made but torn is no map: the game still plays.
    const torn = gameDungeonMapFromDungeon(generateDungeonMap("cave_rock", 1), "Torn", "t1");
    await request.patch(`/api/chats/${chatId}/metadata`, {
      data: { gameDungeonMap: { ...torn, ground: torn.ground.slice(2) } },
    });
    await page.reload();
    await expect(page.locator('[data-component="GameNarration.ActivePanel"]')).toContainText("A quiet road.", {
      timeout: 30_000,
    });
    await expect(page.locator('[data-component="DungeonMapView"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show the map", exact: true })).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
  }
});

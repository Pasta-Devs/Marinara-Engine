import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { WORLD_STARTER_KITS, parseWorldKit } from "@marinara-engine/shared";
import { openGame, savedInventory } from "./game-ruleset-fight-fixture.js";

/**
 * A refused buy on a later turn (laptop playtest 2026-10-25): a turn that already told the player of a
 * buy left its segment marked as told, so the next turn's refusal at the same segment was never shown,
 * though the reply carried it. Each turn is announced afresh, rolled or not.
 */
for (const rolled of [false, true])
  test(`a buy refused on a later ${rolled ? "rolled " : ""}turn is told to the player`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120_000);
    const parsed = parseWorldKit(WORLD_STARTER_KITS.find((kit) => kit.id === "modern_day")!);
    if (!parsed.ok) throw new Error(parsed.issues.join("; "));
    const replies = [
      'We reach Elm Street. [place: name="Elm Street" size="town"] [inventory: action="buy" item="first-aid kit"]',
      `The shop has a bicycle in the window.${rolled ? ' [skill_check: skill="Persuasion" dc="10"]' : ""} [inventory: action="buy" item="Bicycle"]`,
    ];
    let turn = 0;
    const server = createServer(async (incoming, response) => {
      for await (const _chunk of incoming);
      if (incoming.method !== "POST") {
        response.writeHead(404).end();
        return;
      }
      const content = replies[Math.min(turn++, replies.length - 1)];
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      const write = (delta: unknown, finishReason: string | null = null) =>
        response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`);
      write({ content });
      write({}, "stop");
      response.end("data: [DONE]\n\n");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("The model fixture did not bind");
    let connectionId = "";
    let chatId = "";
    try {
      const connection = await request.post("/api/connections", {
        data: {
          name: "Later turn buys fixture",
          provider: "custom",
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          apiKey: "synthetic-test-key",
          model: "later-buys-fixture",
          maxContext: 32768,
          treatAsLocalEndpoint: true,
        },
      });
      connectionId = (await connection.json()).id;
      const created = await request.post("/api/chats", {
        data: { name: "Later buys", mode: "game", characterIds: [], connectionId },
      });
      chatId = ((await created.json()) as { id: string }).id;
      const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
        data: {
          gameId: `later-buys-${chatId}`,
          gameSessionStatus: "active",
          gameIntroPresented: true,
          gameImageAutoGenerationEnabled: false,
          enableAgents: false,
          enableTools: false,
          gameWorldKit: parsed.kit,
          gameOneRequestDice: true,
          gameInventory: [{ id: "st-dollars", name: "dollar", item: "coin:dollar", quantity: 60 }],
        },
      });
      expect(meta.ok(), await meta.text()).toBeTruthy();
      await request.post(`/api/chats/${chatId}/messages`, {
        data: { role: "assistant", content: "The bus drops you at the edge of town." },
      });
      await openGame(page, chatId);
      const narration = page.locator('[data-component="GameNarration.ActivePanel"]');
      await expect(narration).toContainText("The bus drops you at the edge of town.", { timeout: 30_000 });
      const input = page.getByPlaceholder("What do you do?", { exact: true });
      const sendTurn = page.getByRole("button", { name: "Send game turn", exact: true });

      await input.fill("I buy a first-aid kit on Elm Street.");
      await sendTurn.click();
      await expect(narration).toContainText("We reach Elm Street.", { timeout: 30_000 });
      await expect(page.getByText(/^You bought First-Aid Kit/)).toBeVisible({ timeout: 15_000 });

      await expect(sendTurn).toBeVisible({ timeout: 30_000 });
      await input.fill("I buy the bicycle too.");
      await sendTurn.click();
      await expect(narration).toContainText("The shop has a bicycle in the window.", { timeout: 30_000 });
      await expect
        .poll(async () =>
          (await savedInventory(request, chatId)).map((stack) => `${stack.name} ${stack.quantity}`).sort(),
        )
        .toEqual(["First-Aid Kit 1", "dollar 35"]);
      await expect(page.getByText(/^Bicycle was not bought: /)).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: testInfo.outputPath("later-turn-refusal.png") });
    } finally {
      if (chatId) await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
      if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { WORLD_STARTER_KITS, parseWorldKit } from "@marinara-engine/shared";
import { openGame, savedInventory } from "./game-ruleset-fight-fixture.js";

/**
 * A buy on a rolled turn (laptop playtest 2026-10-25): the Game Master says where the party is, asks for
 * a check and buys in the same reply. Rolled in that reply, or narrated again in a second request that
 * leaves the place out, the buys are made at that place, and the one the purse cannot pay for is told
 * to the player, as it is on a turn with no roll.
 */
const REWRITE_INSTRUCTION = "The engine has now rolled the requested dice:";

for (const oneRequest of [true, false])
  test(`a buy refused on a rolled turn is told to the player${oneRequest ? "" : ", rolled in a second request"}`, async ({
    page,
    request,
  }, testInfo) => {
    test.setTimeout(120_000);
    const parsed = parseWorldKit(WORLD_STARTER_KITS.find((kit) => kit.id === "modern_day")!);
    if (!parsed.ok) throw new Error(parsed.issues.join("; "));
    const draft =
      'We reach Elm Street. [place: name="Elm Street" size="town"] [skill_check: skill="Persuasion" dc="10"] ' +
      '[inventory: action="buy" item="first-aid kit"] [inventory: action="buy" item="Bicycle"]';
    const rewrite = "We reach Elm Street, and the shopkeeper warms to you.";
    const calls: string[] = [];
    const server = createServer(async (incoming, response) => {
      let body = "";
      for await (const chunk of incoming) body += chunk;
      if (incoming.method !== "POST") {
        response.writeHead(404).end();
        return;
      }
      const last = (JSON.parse(body) as { messages?: Array<{ content?: unknown }> }).messages?.at(-1)?.content;
      const again = typeof last === "string" && last.includes(REWRITE_INSTRUCTION);
      calls.push(again ? "rewrite" : "draft");
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      const write = (delta: unknown, finishReason: string | null = null) =>
        response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`);
      write({ content: again ? rewrite : draft });
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
          name: "Rolled turn buys fixture",
          provider: "custom",
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          apiKey: "synthetic-test-key",
          model: "rolled-buys-fixture",
          maxContext: 32768,
          treatAsLocalEndpoint: true,
        },
      });
      connectionId = (await connection.json()).id;
      const created = await request.post("/api/chats", {
        data: { name: "Rolled buys", mode: "game", characterIds: [], connectionId },
      });
      chatId = ((await created.json()) as { id: string }).id;
      const meta = await request.patch(`/api/chats/${chatId}/metadata`, {
        data: {
          gameId: `rolled-buys-${chatId}`,
          gameSessionStatus: "active",
          gameIntroPresented: true,
          gameImageAutoGenerationEnabled: false,
          enableAgents: false,
          enableTools: false,
          gameWorldKit: parsed.kit,
          gameOneRequestDice: oneRequest,
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
      await page.getByPlaceholder("What do you do?", { exact: true }).fill("I haggle on Elm Street.");
      await page.getByRole("button", { name: "Send game turn", exact: true }).click();
      await expect(narration).toContainText(oneRequest ? "We reach Elm Street." : "the shopkeeper warms to you", {
        timeout: 30_000,
      });
      expect(calls).toEqual(oneRequest ? ["draft"] : ["draft", "rewrite"]);
      await expect
        .poll(async () =>
          (await savedInventory(request, chatId)).map((stack) => `${stack.name} ${stack.quantity}`).sort(),
        )
        .toEqual(["First-Aid Kit 1", "dollar 35"]);
      const reply = (
        (await (await request.get(`/api/chats/${chatId}/messages`)).json()) as Array<{ role: string; content: string }>
      )
        .filter((message) => message.role === "assistant")
        .at(-1)!.content;
      expect(reply).toContain('item="Bicycle" count="1" level="fair" result="refused" reason="cannot-afford"');
      await expect(page.getByText(/^Bicycle was not bought: /)).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: testInfo.outputPath("rolled-buys.png") });
    } finally {
      if (chatId) await request.delete(`/api/chats/${chatId}`).catch(() => undefined);
      if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

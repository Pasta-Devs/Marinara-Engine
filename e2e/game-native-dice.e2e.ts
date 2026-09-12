import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const theme of ["dark", "light"] as const) {
  test(`Game queues every native roll and skill check and retains their history (${theme})`, async ({
    page,
    request,
  }, testInfo) => {
    page.setDefaultTimeout(10_000);
    const providerRequests: Array<Record<string, unknown>> = [];
    let finishFollowup: (() => void) | undefined;
    let returnedTotal = 0;
    let returnedRolls: Array<{ notation: string; rolls: number[]; modifier: number; total: number }> = [];
    let textOnly = false;
    let outcomeFollowupHasTools: boolean | undefined;
    const provider = createServer(async (incoming, response) => {
      if (incoming.method !== "POST") {
        incoming.resume();
        response.writeHead(404).end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      providerRequests.push(body);
      response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
      const write = (delta: unknown, finishReason: string | null = null) =>
        response.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: finishReason }] })}\n\n`);
      if (textOnly) {
        write({ content: "The path continues." });
        write({}, "stop");
        response.end("data: [DONE]\n\n");
        return;
      }
      if (body.messages?.at(-1)?.content?.includes("The engine has now rolled the requested dice:")) {
        outcomeFollowupHasTools = body.tools !== undefined;
        write({ content: `The roll is ${returnedTotal}. The gate opens.` });
        write({}, "stop");
        response.end("data: [DONE]\n\n");
        return;
      }
      const results = body.messages?.filter((message: { role: string }) => message.role === "tool") ?? [];
      if (results.length >= 3) {
        returnedRolls = results.map((message: { content: string }) => {
          const { notation, rolls, modifier, total } = JSON.parse(message.content);
          return { notation, rolls, modifier, total };
        });
        write({
          content: ` The roll is ${returnedTotal}. The gate opens.\n[skill_check: skill="Stealth" dc="10"]\n[skill_check: skill="Perception" dc="12"]`,
        });
        write({}, "stop");
        response.end("data: [DONE]\n\n");
      } else if (results.length) {
        returnedRolls = results.map((message: { content: string }) => {
          const { notation, rolls, modifier, total } = JSON.parse(message.content);
          return { notation, rolls, modifier, total };
        });
        returnedTotal = returnedRolls[0]!.total;
        response.flushHeaders();
        // The browser must show the real tool result before this second model
        // response is allowed to finish. No paid provider is called by this test.
        finishFollowup = () => {
          write(
            {
              tool_calls: [
                {
                  index: 0,
                  id: "roll-three",
                  type: "function",
                  function: {
                    name: "roll_dice",
                    arguments: JSON.stringify({ notation: "1d4" }),
                  },
                },
              ],
            },
            "tool_calls",
          );
          response.end("data: [DONE]\n\n");
        };
      } else {
        write({ content: "Let the die decide." });
        write(
          {
            tool_calls: [
              {
                index: 0,
                id: "roll-one",
                type: "function",
                function: {
                  name: "roll_dice",
                  arguments: JSON.stringify({ notation: "1d20+3" }),
                },
              },
              {
                index: 1,
                id: "roll-two",
                type: "function",
                function: { name: "roll_dice", arguments: JSON.stringify({ notation: "2d6" }) },
              },
            ],
          },
          "tool_calls",
        );
        response.end("data: [DONE]\n\n");
      }
    });
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    let connectionId = "";
    let chatId = "";
    try {
      const address = provider.address();
      if (!address || typeof address === "string") throw new Error("Dice fixture did not bind");
      const connection = await request.post("/api/connections", {
        data: {
          name: "Local dice fixture",
          provider: "custom",
          baseUrl: `http://127.0.0.1:${address.port}/v1`,
          apiKey: "synthetic-test-key",
          model: "dice-fixture",
          maxContext: 32768,
          treatAsLocalEndpoint: true,
        },
      });
      expect(connection.ok()).toBeTruthy();
      connectionId = (await connection.json()).id;
      const chat = await request.post("/api/chats", {
        data: {
          name: "Native dice browser proof",
          mode: "game",
          characterIds: [],
          connectionId,
        },
      });
      expect(chat.ok()).toBeTruthy();
      chatId = (await chat.json()).id;
      expect(
        (
          await request.patch(`/api/chats/${chatId}/metadata`, {
            data: {
              gameId: chatId,
              gameSessionStatus: "active",
              gameIntroPresented: true,
              gameImageAutoGenerationEnabled: false,
              enableAgents: false,
              enableTools: false,
              forceToolCall: true,
            },
          })
        ).ok(),
      ).toBeTruthy();
      expect(
        (
          await request.post(`/api/chats/${chatId}/messages`, {
            data: {
              role: "assistant",
              content: "A gate blocks the path.",
            },
          })
        ).ok(),
      ).toBeTruthy();
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["game"],
        gameInstantTextReveal: true,
        debugMode: false,
        theme,
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chatId, version },
      );
      await page.goto("/");
      const narration = page.locator('[data-component="GameNarration.ActivePanel"]');
      await expect(narration).toContainText("A gate blocks the path.");
      await page.getByPlaceholder("What do you do?", { exact: true }).fill("Try the gate.");
      await page.getByRole("button", { name: "Send game turn", exact: true }).click();
      const card = page.locator(".dice-roll-card--game");
      await expect.poll(() => Boolean(finishFollowup)).toBe(true);
      // With the follow-up paused before its first token, WebKit can deliver
      // this tiny SSE batch on the existing 15-second keepalive. The card must
      // still appear while the model response remains unfinished.
      await expect(card).toBeVisible({ timeout: 20_000 });
      // Game intentionally keeps the previous scene visible until processing
      // finishes. Tokens must still arrive in the live buffer during the roll.
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
            return { text: useChatStore.getState().streamBuffer, streaming: useChatStore.getState().isStreaming };
          }),
        )
        .toEqual({ text: "Let the die decide.", streaming: true });
      await expect(narration).not.toContainText("The gate opens.");
      await expect(card.locator(".dice-roll-total")).toHaveText(`= ${returnedTotal}`);
      await card.getByRole("button", { name: "Dismiss dice roll result" }).click();
      await expect(card).toContainText("2d6");
      await expect(card.locator(".dice-roll-total")).toHaveText(`= ${returnedRolls[1]!.total}`);
      const firstRequest = providerRequests[0] as {
        tools: Array<{ function: { name: string } }>;
        tool_choice?: unknown;
        messages: Array<{ role: string; content: string }>;
      };
      expect(firstRequest.tools.map((tool) => tool.function.name)).toEqual(["roll_dice"]);
      expect(firstRequest.tool_choice).not.toBe("required");
      expect(firstRequest.messages.some((message) => message.content?.includes("<available_functions>"))).toBe(true);
      await card.getByRole("button", { name: "Dismiss dice roll result" }).click();
      await expect(card).toHaveCount(0);
      finishFollowup!();
      finishFollowup = undefined;
      await expect(card).toContainText("1d4");
      await expect(card.locator(".dice-roll-total")).toHaveText(`= ${returnedRolls[2]!.total}`);
      await card.getByRole("button", { name: "Dismiss dice roll result" }).click();
      await expect(narration).toContainText(`The roll is ${returnedTotal}. The gate opens.`);
      expect(outcomeFollowupHasTools).toBe(false);
      await expect
        .poll(async () => {
          const rows = await (await request.get(`/api/chats/${chatId}/messages`)).json();
          const last = rows.at(-1);
          const extra = typeof last?.extra === "string" ? JSON.parse(last.extra) : last?.extra;
          return extra?.diceRollResults;
        })
        .toEqual(returnedRolls);
      const skillCard = page.locator(".skill-check-roll--game");
      await expect(skillCard).toContainText("Stealth");
      await skillCard.getByRole("button", { name: "Dismiss dice roll result" }).click();
      await expect(skillCard).toContainText("Perception");
      await skillCard.getByRole("button", { name: "Dismiss dice roll result" }).click();
      await expect(skillCard).toHaveCount(0);
      await page.reload();
      await expect(narration).toContainText("The gate opens.");
      await page.getByRole("button", { name: "Logs", exact: true }).click();
      const logs = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Session Logs" }) });
      for (const roll of returnedRolls) {
        await expect(logs).toContainText(`🎲 ${roll.notation}: ${roll.rolls.join(" + ")}`);
      }
      const proseRow = logs.locator('[class~="group/logseg"]').filter({ hasText: "The gate opens." });
      await expect(proseRow.getByRole("button", { name: "Translate", exact: true })).toBeVisible();
      const diceRow = logs.locator('[class~="group/logseg"]').filter({ hasText: `🎲 ${returnedRolls[0]!.notation}:` });
      await expect(diceRow.getByRole("button", { name: "Translate", exact: true })).toHaveCount(0);
      await testInfo.attach(`all-dice-history-${theme}.png`, {
        body: await logs.screenshot({ path: testInfo.outputPath(`all-dice-history-${theme}.png`) }),
        contentType: "image/png",
      });
      const translatedMessage = (await (await request.get(`/api/chats/${chatId}/messages`)).json()).at(-1);
      await page.evaluate(async ({ id, content }: { id: string; content: string }) => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        const { useTranslationStore } = await import("/src/stores/translation.store.ts" as string);
        const chat = useChatStore.getState().activeChat;
        const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
        useChatStore.getState().setActiveChat({ ...chat, metadata: { ...metadata, translationDisplayOnly: true } });
        useTranslationStore.getState().setTranslation(id, "Brama się otwiera.", content);
      }, translatedMessage);
      await expect(logs).toContainText("Brama się otwiera.");
      for (const roll of returnedRolls) {
        await expect(logs).toContainText(`🎲 ${roll.notation}: ${roll.rolls.join(" + ")}`);
      }
      await page.evaluate(async () => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        const { useTranslationStore } = await import("/src/stores/translation.store.ts" as string);
        const chat = useChatStore.getState().activeChat;
        const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
        useChatStore.getState().setActiveChat({ ...chat, metadata: { ...metadata, translationDisplayOnly: false } });
        useTranslationStore.getState().clearAll();
      });
      await logs.getByRole("button", { name: "Close logs", exact: true }).click();
      const nextScene = await request.post(`/api/chats/${chatId}/messages`, {
        data: { role: "assistant", content: "A new scene begins." },
      });
      expect(nextScene.ok()).toBeTruthy();
      const nextSceneId = (await nextScene.json()).id;
      await page.reload();
      await expect(narration).toContainText("A new scene begins.");
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setGameDialogueDisplayMode("stacked");
      });
      const stackedProse = page.locator('[class~="group/logseg"]').filter({ hasText: "The gate opens." });
      await expect(stackedProse.getByRole("button", { name: "Translate", exact: true })).toBeVisible();
      await page.evaluate(async ({ id, content }: { id: string; content: string }) => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        const { useTranslationStore } = await import("/src/stores/translation.store.ts" as string);
        const chat = useChatStore.getState().activeChat;
        const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
        useChatStore.getState().setActiveChat({ ...chat, metadata: { ...metadata, translationDisplayOnly: true } });
        useTranslationStore.getState().setTranslation(id, "Brama się otwiera.", content);
      }, translatedMessage);
      await expect(page.locator('[class~="group/logseg"]').filter({ hasText: "Brama się otwiera." })).toHaveCount(1);
      for (const roll of returnedRolls) {
        await expect(
          page.locator('[class~="group/logseg"]').filter({ hasText: `🎲 ${roll.notation}: ${roll.rolls.join(" + ")}` }),
        ).toHaveCount(1);
      }
      await page.screenshot({ path: testInfo.outputPath(`stacked-dice-history-${theme}.png`) });
      expect((await request.delete(`/api/chats/${chatId}/messages/${nextSceneId}`)).ok()).toBeTruthy();
      await page.reload();
      await expect(narration).toContainText(/The gate opens\.|Try the gate\./);
      if (await narration.getByText("Try the gate.", { exact: true }).isVisible()) {
        await narration.getByRole("button", { name: "Next", exact: true }).click();
      }
      await expect(narration).toContainText("The gate opens.");
      if (testInfo.project.name.includes("mobile")) {
        await page.getByRole("button", { name: "Game actions", exact: true }).click();
      }
      await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
      const section = page.locator('[data-chat-settings-section="function-calling"]');
      await section.locator('[role="button"][aria-expanded]').click();
      await expect(section).toContainText("Game chats already roll real dice without this");
      await expect(section).not.toContainText("If disabled, no functions will be available.");
      await expect(section.getByLabel("Enable Tool Use", { exact: true })).not.toBeChecked();
      await testInfo.attach(`game-tool-hint-${theme}-${testInfo.project.name}.png`, {
        body: await section.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
      // A continuation extends the rolled message; a regeneration replaces it.
      // Exercise both real persistence paths, without asking for another roll.
      const rows = await (await request.get(`/api/chats/${chatId}/messages`)).json();
      const savedMessageId = rows.at(-1).id;
      textOnly = true;
      const continued = await request.post("/api/generate", { data: { chatId, continueMessageId: savedMessageId } });
      expect(continued.ok()).toBeTruthy();
      const continuedRows = await (await request.get(`/api/chats/${chatId}/messages`)).json();
      const continuedMessage = continuedRows.find((row: { id: string }) => row.id === savedMessageId);
      expect(continuedMessage.content).toContain("The path continues.");
      const continuedExtra =
        typeof continuedMessage.extra === "string" ? JSON.parse(continuedMessage.extra) : continuedMessage.extra;
      expect(continuedExtra.diceRollResults).toEqual(returnedRolls);
      expect(continuedExtra.diceRollResult).toBeNull();
      const regenerated = await request.post("/api/generate", {
        data: { chatId, regenerateMessageId: savedMessageId },
      });
      expect(regenerated.ok()).toBeTruthy();
      const regeneratedRows = await (await request.get(`/api/chats/${chatId}/messages`)).json();
      const regeneratedMessage = regeneratedRows.find((row: { id: string }) => row.id === savedMessageId);
      const regeneratedExtra =
        typeof regeneratedMessage.extra === "string" ? JSON.parse(regeneratedMessage.extra) : regeneratedMessage.extra;
      expect(regeneratedExtra.diceRollResult).toBeNull();
      expect(regeneratedExtra.diceRollResults).toEqual([]);
      await page.reload();
      await expect(narration).toContainText("The path continues.");
      await page.evaluate(async () => {
        const { useGameModeStore } = await import("/src/stores/game-mode.store.ts" as string);
        useGameModeStore.getState().setDiceRollResult({ notation: "2d1", rolls: [1, 1], modifier: 0, total: 2 });
      });
      await expect(card).toContainText("2d1");
      await page.getByPlaceholder("What do you do?", { exact: true }).fill("Keep walking.");
      const sent = page.waitForResponse(
        (response) => response.url().includes("/api/generate") && response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Send game turn", exact: true }).click();
      await sent;
      await expect(card).toContainText("2d1");
    } finally {
      finishFollowup?.();
      await page.close().catch(() => undefined);
      if (chatId) await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
      if (connectionId) await request.delete(`/api/connections/${connectionId}`).catch(() => undefined);
      provider.closeAllConnections();
      await new Promise<void>((resolve, reject) => provider.close((error) => (error ? reject(error) : resolve())));
    }
  });
}

test("Classic Conversation keeps an assistant dice card beside every content part", async ({ page, request }) => {
  const response = await request.post("/api/chats", {
    data: { name: "Split dice message proof", mode: "conversation", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = await response.json();
  try {
    const message = await request.post(`/api/chats/${chat.id}/messages`, {
      data: {
        role: "assistant",
        content: "First rolled paragraph.\n\nSecond consequence paragraph.",
        extra: { diceRollResult: { notation: "1d20+3", rolls: [12], modifier: 3, total: 15 } },
      },
    });
    expect(message.ok()).toBeTruthy();
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation"],
      conversationMessageStyle: "classic",
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    await page.goto("/");
    const content = page.locator('[data-component="ConversationMessage.Content"]');
    await expect(content).toContainText("First rolled paragraph.");
    await expect(content).toContainText("Second consequence paragraph.");
    await expect(content.locator(".dice-roll-card")).toHaveCount(1);
    await expect(content.locator(".dice-roll-total")).toHaveText("= 15");
  } finally {
    await page.close().catch(() => undefined);
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

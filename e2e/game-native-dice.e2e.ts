import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const theme of ["dark", "light"] as const) {
  test(`Game shows a native dice result before the tool follow-up finishes (${theme})`, async ({
    page,
    request,
  }, testInfo) => {
    page.setDefaultTimeout(10_000);
    const providerRequests: Array<Record<string, unknown>> = [];
    let finishFollowup: (() => void) | undefined;
    let returnedTotal = 0;
    let textOnly = false;
    const provider = createServer(async (incoming, response) => {
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
      const result = body.messages?.find((message: { role: string }) => message.role === "tool");
      if (result) {
        returnedTotal = JSON.parse(result.content).total;
        response.flushHeaders();
        // The browser must show the real tool result before this second model
        // response is allowed to finish. No paid provider is called by this test.
        finishFollowup = () => {
          write({ content: ` The roll is ${returnedTotal}. The gate opens.` });
          write({}, "stop");
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
      const firstRequest = providerRequests[0] as {
        tools: Array<{ function: { name: string } }>;
        tool_choice?: unknown;
        messages: Array<{ role: string; content: string }>;
      };
      expect(firstRequest.tools.map((tool) => tool.function.name)).toEqual(["roll_dice"]);
      expect(firstRequest.tool_choice).not.toBe("required");
      expect(firstRequest.messages.some((message) => message.content?.includes("<available_functions>"))).toBe(true);
      await expect(card).toHaveClass(/is-settled/);
      await testInfo.attach(`native-dice-${theme}-${testInfo.project.name}.png`, {
        body: await card.screenshot({ animations: "disabled" }),
        contentType: "image/png",
      });
      finishFollowup!();
      finishFollowup = undefined;
      await expect(narration).toContainText(`The roll is ${returnedTotal}. The gate opens.`);
      await expect
        .poll(async () => {
          const rows = await (await request.get(`/api/chats/${chatId}/messages`)).json();
          const last = rows.at(-1);
          const extra = typeof last?.extra === "string" ? JSON.parse(last.extra) : last?.extra;
          return extra?.diceRollResult?.total;
        })
        .toBe(returnedTotal);
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
      expect(continuedExtra.diceRollResult?.total).toBe(returnedTotal);
      const regenerated = await request.post("/api/generate", {
        data: { chatId, regenerateMessageId: savedMessageId },
      });
      expect(regenerated.ok()).toBeTruthy();
      const regeneratedRows = await (await request.get(`/api/chats/${chatId}/messages`)).json();
      const regeneratedMessage = regeneratedRows.find((row: { id: string }) => row.id === savedMessageId);
      const regeneratedExtra =
        typeof regeneratedMessage.extra === "string" ? JSON.parse(regeneratedMessage.extra) : regeneratedMessage.extra;
      expect(regeneratedExtra.diceRollResult).toBeNull();
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

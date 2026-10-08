import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
test.use({ reducedMotion: "reduce" });

// #7286: a location fixed in the Tracker Panel is what regenerating that reply starts from.
test("A Tracker Panel edit is the base for regenerating the edited reply", async ({ page, request, isMobile }) => {
  test.setTimeout(120_000);
  const prompts: string[] = [];
  const provider = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    prompts.push(JSON.stringify(body.messages ?? []));
    const content = "The story continues by the water.";
    if (body.stream) {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
      );
    } else {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({ choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] }),
      );
    }
  });
  await new Promise<void>((done) => provider.listen(0, "127.0.0.1", done));
  const address = provider.address();
  if (!address || typeof address === "string") throw new Error("Missing provider port");
  const connectionResponse = await request.post("/api/connections", {
    data: {
      name: "Tracker edit fixture",
      provider: "custom",
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      apiKey: "fixture",
      model: "tracker-edit-fixture",
      maxContext: 32768,
    },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Tracker edit base", mode: "roleplay", characterIds: [], connectionId: connection.id },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  try {
    // Trackers are run by hand in this chat, so only the user's edit can change the panel.
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: { enableAgents: true, activeAgentIds: ["world-state"], manualTrackers: true },
        })
      ).ok(),
    ).toBeTruthy();
    const post = async (role: "user" | "assistant", content: string) => {
      const response = await request.post(`/api/chats/${chat.id}/messages`, { data: { role, content } });
      expect(response.ok()).toBeTruthy();
      return (await response.json()) as { id: string };
    };
    const track = async (messageId: string, location: string) => {
      const response = await request.patch(`/api/chats/${chat.id}/game-state`, {
        data: { messageId, swipeIndex: 0, location },
      });
      expect(response.ok()).toBeTruthy();
    };
    await track((await post("assistant", "We stand in the square.")).id, "Old town");
    await post("user", "We walk to the river.");
    const reply = await post("assistant", "We reach the riverbank.");
    await track(reply.id, "Wrong place");

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      sidebarOpen: false,
      rightPanelOpen: false,
      trackerPanelEnabled: true,
      trackerPanelOpen: true,
      trackerPanelOpenByChatId: { [chat.id]: true },
      appAccentPulseMode: false,
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    const trackerToggle = page.locator('.mari-window-bubble[data-tracker-panel-toggle="bubble"]');
    const tracker = page.locator('[data-component="TrackerDataSidebar"]:visible');
    const openTracker = async () => {
      await page.goto("/");
      if (isMobile) await trackerToggle.click();
      await expect(tracker).toBeVisible({ timeout: 30_000 });
    };
    const location = (value: string) => page.getByRole("button", { name: new RegExp(`^Location: ${value}`) });

    await openTracker();
    await location("Wrong place").click();
    const saved = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/chats/${chat.id}/game-state`) && response.request().method() === "PATCH",
    );
    await page.getByRole("textbox", { name: "Location", exact: true }).fill("Right place");
    await page.getByRole("textbox", { name: "Location", exact: true }).press("Enter");
    expect((await saved).ok()).toBeTruthy();

    // The edit survives a reload.
    await openTracker();
    await expect(location("Right place")).toBeVisible();

    // On a phone the Tracker Panel covers the chat.
    if (isMobile) await tracker.getByRole("button", { name: "Close tracker panel", exact: true }).click();
    const row = page.locator(`[data-message-id="${reply.id}"]`);
    await expect(row).toBeVisible();
    prompts.length = 0;
    const regeneration = page.waitForResponse(
      (response) => response.url().endsWith("/api/generate") && response.request().method() === "POST",
    );
    await row.getByRole("button", { name: "Generate next swipe", exact: true }).click();
    if (isMobile) {
      await page
        .getByRole("dialog", { name: "Regenerate Message", exact: true })
        .getByRole("button", { name: "Regenerate", exact: true })
        .click();
    }
    expect((await regeneration).request().postDataJSON()).toMatchObject({ regenerateMessageId: reply.id });
    await expect(row.getByRole("textbox", { name: "Jump to swipe, 1 through 2", exact: true })).toHaveValue("2");
    const prompt = prompts.join("\n");
    expect(prompt).toContain("Location: Right place");
    expect(prompt).not.toContain("Old town");
    expect(prompt).not.toContain("Wrong place");

    // The new swipe keeps the edit, on screen and after a reload.
    await expect
      .poll(async () => (await (await request.get(`/api/chats/${chat.id}/game-state`)).json()).location)
      .toBe("Right place");
    await openTracker();
    await expect(location("Right place")).toBeVisible();
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`).catch(() => undefined);
    await request.delete(`/api/connections/${connection.id}`).catch(() => undefined);
    provider.closeAllConnections();
    await new Promise<void>((done) => provider.close(() => done()));
  }
});

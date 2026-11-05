import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

// A saved request predates the summary and hiding that ran after its reply, so Peek Prompt says so and
// builds the current context on request (#8831).
test("Peek Prompt labels the sent request and switches to the current context", async ({ page, request }, info) => {
  const characterResponse = await request.post("/api/characters", {
    data: { data: { name: "Peek Current Fixture", first_mes: "" } },
  });
  expect(characterResponse.ok()).toBeTruthy();
  const character = await characterResponse.json();
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Peek Current", mode: "roleplay", characterIds: [character.id], connectionId: "synthetic-peek" },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = await chatResponse.json();
  try {
    const messageResponse = await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "The lantern is lit.", characterId: character.id },
    });
    expect(messageResponse.ok()).toBeTruthy();
    const message = await messageResponse.json();
    const bodies: unknown[] = [];
    await page.route(`**/api/chats/${chat.id}/peek-prompt`, (route) => {
      const body = route.request().postDataJSON();
      bodies.push(body);
      const current = body?.current === true;
      return route.fulfill({
        json: {
          messages: [
            { role: "system", content: "Rules." },
            { role: "user", content: current ? "CURRENT_CONTEXT_ONLY" : "SENT_REQUEST_ONLY" },
          ],
          parameters: {},
          chatMode: "roleplay",
          exact: !current,
          source: current ? "live_preview" : "cached",
        },
      });
    });
    await isolateSyncedUISettings(page);
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["roleplay", "conversation"],
      appAccentPulseMode: false,
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    await page.goto("/");
    const row = page.locator(`[data-message-id="${message.id}"]`).first();
    if (info.project.name.includes("mobile")) await row.getByText("The lantern is lit.", { exact: true }).tap();
    else await row.hover();
    await row.getByRole("button", { name: "Peek prompt", exact: true }).click();
    const viewer = page.getByRole("dialog", { name: "Assembled Prompt", exact: true });
    await expect(viewer.getByText("Exact Text Model Request", { exact: true })).toBeVisible();
    await expect(viewer.getByText(/^This is the request as sent for this reply\./u)).toBeVisible();
    await viewer.getByRole("button", { name: "Show current context", exact: true }).click();
    await expect(viewer.getByText("Live Preview", { exact: true })).toBeVisible();
    await expect(viewer.getByText(/^This is the current context, built now from the chat as it is/u)).toBeVisible();
    await viewer.getByRole("searchbox", { name: "Find in prompt", exact: true }).fill("CURRENT_CONTEXT_ONLY");
    await expect(viewer.getByText("CURRENT_CONTEXT_ONLY", { exact: true })).toBeVisible();
    await viewer.getByRole("searchbox", { name: "Find in prompt", exact: true }).fill("");
    await page.screenshot({ path: info.outputPath("peek-current-context.png"), animations: "disabled" });
    // Going back shows the saved request again without another request.
    await viewer.getByRole("button", { name: "Show sent request", exact: true }).click();
    await expect(viewer.getByText("Exact Text Model Request", { exact: true })).toBeVisible();
    expect(bodies).toEqual([{ messageId: message.id }, { current: true }]);
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

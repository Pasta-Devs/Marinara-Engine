import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

test("agent output and private context have separate editors inside the spoiler", async ({ page }, testInfo) => {
  const created = await page.request.post("/api/chats", {
    data: { name: "Private agent context fixture", mode: "roleplay", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  let resultData: Record<string, unknown> = { text: "", "agent-context": { plan: "Private garden plan" } };
  let rejectSave = false;
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route(`**/api/agents/runs/${chat.id}/custom`, (route) =>
    route.fulfill({
      json: [
        {
          id: "private-context-run",
          agentConfigId: "private-config",
          agentType: "custom-private",
          agentName: "Garden planner",
          chatId: chat.id,
          messageId: "fixture-message",
          resultType: "custom",
          resultData,
          tokensUsed: 12,
          durationMs: 100,
          success: true,
          error: null,
          createdAt: "2026-09-16T12:00:00Z",
          hideOutput: true,
        },
      ],
    }),
  );
  await page.route("**/api/agents/runs/private-context-run", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    if (rejectSave) return route.fulfill({ status: 500, json: { message: "Fixture save failed" } });
    resultData = route.request().postDataJSON().resultData;
    await route.fulfill({ json: { success: true } });
  });
  try {
    await page.request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "A quiet day in the garden." },
    });
    await seedUIState(
      page,
      {
        hasCompletedOnboarding: true,
        rightPanelOpen: false,
        sidebarOpen: false,
        appAccentPulseMode: false,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
      },
      "if-missing",
    );
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version: JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version },
    );
    await page.goto("/");
    await expect(page.getByText("A quiet day in the garden.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Agents & Actions", exact: true }).click();
    await page.getByRole("button", { name: /Custom outputs/ }).click();
    const spoiler = page.locator("details").filter({ hasText: "Garden planner" });
    await expect(spoiler.getByText("Garden planner", { exact: true })).not.toBeVisible();
    await spoiler.locator("summary").click();
    await testInfo.attach("agent-context-dark", {
      body: await page.screenshot({ path: testInfo.outputPath("agent-context-dark.png") }),
      contentType: "image/png",
    });
    const output = spoiler.getByRole("group", { name: "Output", exact: true });
    const context = spoiler.getByRole("group", { name: "Private context", exact: true });
    await expect(output).toContainText("Empty output");
    await expect(output).not.toContainText("Private garden plan");
    await expect(context).toContainText("Private garden plan");
    await output.getByTitle("Edit output", { exact: true }).click();
    await output.getByRole("textbox", { name: "Output", exact: true }).fill("Public garden notes");
    await output.getByRole("button", { name: "Save", exact: true }).click();
    await expect(output).toContainText("Public garden notes");
    expect(resultData["agent-context"]).toEqual({ plan: "Private garden plan" });
    await context.getByTitle("Edit private context", { exact: true }).click();
    await context.getByRole("textbox", { name: "Private context", exact: true }).fill("{");
    await context.getByRole("button", { name: "Save", exact: true }).click();
    await expect(context.getByRole("alert")).toBeVisible();
    expect(resultData["agent-context"]).toEqual({ plan: "Private garden plan" });
    await context.getByRole("textbox").fill('{"plan":"Edited private plan"}');
    rejectSave = true;
    await context.getByRole("button", { name: "Save", exact: true }).click();
    await expect(context.getByRole("alert")).toBeVisible();
    rejectSave = false;
    await context.getByRole("button", { name: "Save", exact: true }).click();
    await expect(context.getByRole("textbox")).toHaveCount(0);
    expect(resultData).toEqual({ text: "Public garden notes", "agent-context": { plan: "Edited private plan" } });
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setTheme("light");
    });
    await testInfo.attach("agent-context-light", {
      body: await page.screenshot({ path: testInfo.outputPath("agent-context-light.png") }),
      contentType: "image/png",
    });
    await context.getByTitle("Edit private context", { exact: true }).click();
    await context.getByRole("textbox").fill("null");
    await context.getByRole("button", { name: "Save", exact: true }).click();
    await expect(context.getByRole("textbox")).toHaveCount(0);
    expect(resultData["agent-context"]).toBeNull();
    await context.getByTitle("Edit private context", { exact: true }).click();
    await expect(context.getByRole("textbox")).toHaveValue("null");
    await context.getByRole("textbox").fill('"Private text"');
    await context.getByRole("button", { name: "Save", exact: true }).click();
    await expect(context.getByRole("textbox")).toHaveCount(0);
    await context.getByTitle("Edit private context", { exact: true }).click();
    await expect(context.getByRole("textbox")).toHaveValue("Private text");
    await context.getByRole("textbox").fill("");
    await context.getByRole("button", { name: "Save", exact: true }).click();
    await expect(context.getByRole("textbox")).toHaveCount(0);
    expect(resultData).toEqual({ text: "Public garden notes", "agent-context": "" });
    const bounds = await spoiler.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await spoiler.locator("summary").click();
    await expect(output).not.toBeVisible();
    await expect(context).not.toBeVisible();
  } finally {
    await page.request.delete(`/api/chats/${chat.id}`);
  }
});

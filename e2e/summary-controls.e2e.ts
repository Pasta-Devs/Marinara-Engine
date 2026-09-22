import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createChatSummaryEntry } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("summary toggles keep other entries usable and toggle all in one save", async ({ page, request }, info) => {
  const created = await request.post("/api/chats", { data: { name: "Summary controls", mode: "roleplay" } });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
  const entries = Array.from({ length: 19 }, (_, index) =>
    createChatSummaryEntry({
      id: `summary-${index}`,
      title: `Summary ${index + 1}`,
      content: "Historical facts. ".repeat(1800),
      enabled: true,
      sourceMode: "range",
      rangeStartIndex: index * 50 + 1,
      rangeEndIndex: (index + 1) * 50,
    }),
  );
  expect((await request.patch(`/api/chats/${id}/metadata`, { data: { summaryEntries: entries } })).ok()).toBeTruthy();
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const saves: Array<{ operation: string; entryIds?: string[] }> = [];
  await page.route(`**/api/chats/${id}/summary-entries`, async (route) => {
    saves.push(route.request().postDataJSON());
    if (saves.length === 1) await gate;
    await route.continue();
  });
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id, version },
    );
    await page.goto("/");
    if (info.project.name.includes("mobile"))
      await page.getByRole("button", { name: "More options", exact: true }).click();
    await page
      .getByRole("button", { name: "Chat Summary (19 active summaries)", exact: true })
      .filter({ visible: true })
      .click();
    const panel = page.locator("[data-chat-floating-panel]").filter({ hasText: "Chat Summary" });
    const toggles = panel.getByRole("button", { name: "Disable summary", exact: true });
    await expect(toggles).toHaveCount(19);
    await toggles.nth(0).click();
    await expect.poll(() => saves.length).toBe(1);
    await expect(toggles.nth(0)).toBeDisabled();
    await expect(toggles.nth(1)).toBeEnabled();
    await panel.getByRole("button", { name: "Expand summary entry", exact: true }).nth(1).click();
    await expect(panel.getByRole("button", { name: "Collapse summary entry", exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("summary-toggle-other-rows-usable.png") });
    release!();
    await expect(toggles).toHaveCount(18);
    await panel.getByRole("button", { name: "Deactivate All", exact: true }).click();
    await expect.poll(() => saves.length).toBe(2);
    expect(saves[1]!.entryIds).toHaveLength(18);
    await expect(panel.getByRole("button", { name: "Activate All", exact: true })).toBeEnabled();
    await panel.getByRole("button", { name: "Activate All", exact: true }).click();
    await expect(toggles).toHaveCount(19);
    expect(saves).toHaveLength(3);
    expect(saves[2]!.entryIds).toHaveLength(19);
    const metadata = (await (await request.get(`/api/chats/${id}`)).json()).metadata;
    expect(metadata.summaryEntries.every((entry: { enabled: boolean }) => entry.enabled)).toBe(true);
  } finally {
    release?.();
    await request.delete(`/api/chats/${id}?force=true`);
  }
});

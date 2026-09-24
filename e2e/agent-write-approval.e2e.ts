import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const theme of ["light", "dark"] as const) {
  test(`agent write reviews preserve queued proposals during typing (${theme})`, async ({ page, request }, info) => {
    const created = await request.post("/api/chats", { data: { name: "Review focus", mode: "roleplay" } });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();
    const commits: Array<{ kind: string; text: string }> = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await page.route(`**/api/chats/${id}/agent-write-approval/commit`, (route) => {
        commits.push(route.request().postDataJSON());
        return route.fulfill({ json: { success: true } });
      });
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        chatHelpSeenModes: ["conversation", "roleplay", "game"],
        sidebarOpen: false,
        rightPanelOpen: false,
        theme,
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id, version },
      );
      await page.goto("/");
      const composer = page.locator("textarea").filter({ visible: true }).first();
      await composer.fill("My next reply");
      await page.evaluate(async (chatId) => {
        const [{ useAgentStore }, { useUIStore }] = await Promise.all([
          import("/src/stores/agent.store.ts" as string) as Promise<PageAgentStoreModule>,
          import("/src/stores/ui.store.ts" as string) as Promise<PageUiStoreModule>,
        ]);
        for (const kind of ["lorebook_update", "summary_update"] as const) {
          useAgentStore.getState().enqueuePendingAgentWriteApproval({
            id: kind,
            kind,
            chatId,
            agentType: kind === "lorebook_update" ? "lorebook-keeper" : "chat-summary",
            agentName: "Review agent",
            title: "Pending update",
            text: kind === "lorebook_update" ? "### Library\n\nA quiet library." : "The group visited the library.",
            canRegenerate: false,
            timestamp: Date.now(),
          });
        }
        useUIStore.getState().openModal("agent-write-approval");
      }, id);

      const lorebook = page.getByRole("dialog", { name: "Review Lorebook Update", exact: true });
      await expect(lorebook).toBeVisible();
      await expect.poll(() => lorebook.evaluate((node) => node.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Space");
      await page.keyboard.press("Enter");
      await expect(lorebook).toBeVisible();
      await expect(lorebook.locator("textarea")).toHaveValue("### Library\n\nA quiet library.");
      expect(commits).toEqual([]);
      await page.screenshot({ path: info.outputPath(`review-focus-${theme}.png`) });

      await page.keyboard.press("Tab");
      await expect(lorebook.locator("textarea")).toBeFocused();
      await lorebook.locator("textarea").fill("### Library\n\nAn edited library.");
      const accept = lorebook.getByRole("button", { name: "Accept", exact: true });
      await accept.focus();
      await page.keyboard.press("Space");

      const summary = page.getByRole("dialog", { name: "Review Summary Update", exact: true });
      await expect(summary).toBeVisible();
      await page.keyboard.press("Space");
      await page.keyboard.press("Enter");
      await expect(summary).toBeVisible();
      await expect(summary.locator("textarea")).toHaveValue("The group visited the library.");
      expect(commits).toEqual([
        {
          kind: "lorebook_update",
          text: "### Library\n\nAn edited library.",
          payload: {},
          agentName: "Review agent",
          agentType: "lorebook-keeper",
        },
      ]);
      const discard = summary.getByRole("button", { name: "Discard", exact: true });
      await discard.focus();
      await page.keyboard.press("Space");
      await expect(summary).toBeHidden();
      await expect(composer).toHaveValue("My next reply");
      expect(errors).toEqual([]);
    } finally {
      await request.delete(`/api/chats/${id}?force=true`);
    }
  });
}

import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatSettingsTool } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const scenarios = [
  {
    mode: "roleplay",
    recentLabel: "Recent summaries",
    olderLabel: "Older summaries",
    switchLabel: "Semantic retrieval",
  },
  {
    mode: "conversation",
    recentLabel: "Recent weeks",
    olderLabel: "Older weeks",
    switchLabel: "Semantic summary retrieval",
  },
] as const;

const savedValues = {
  semanticSummaryRecentCount: 6,
  semanticSummaryOlderCount: 8,
  semanticSummaryMinSimilarity: 0.42,
};

for (const scenario of scenarios) {
  test(`${scenario.mode} semantic recall controls persist and follow the retrieval switch`, async ({
    page,
    request,
  }, testInfo) => {
    const created = await request.post("/api/chats", {
      data: { name: `${scenario.mode} Semantic Recall Controls`, mode: scenario.mode, characterIds: [] },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = (await created.json()) as { id: string };
    const metadata = async () => {
      const response = await request.get(`/api/chats/${id}`);
      expect(response.ok()).toBeTruthy();
      const chat = (await response.json()) as { metadata?: unknown };
      return typeof chat.metadata === "string"
        ? (JSON.parse(chat.metadata) as Record<string, unknown>)
        : ((chat.metadata ?? {}) as Record<string, unknown>);
    };

    const openControlsSurface = async () => {
      if (scenario.mode === "roleplay") {
        const panel = await openChatSettingsTool(page, "chat-summary");
        await expect(panel).toContainText("Automatic Summaries");
        return panel;
      }

      await page.getByRole("button", { name: "Chat Settings", exact: true }).filter({ visible: true }).click();
      const drawer = page.locator(".mari-chat-settings-drawer");
      await expect(drawer).toBeVisible();
      const section = drawer.locator('[data-chat-settings-section="conversation-automatic-summarization"]');
      const sectionToggle = section.locator('[role="button"][aria-expanded]');
      if ((await sectionToggle.getAttribute("aria-expanded")) === "false") await sectionToggle.click();
      return section;
    };

    try {
      if (scenario.mode === "roleplay") {
        const updated = await request.patch(`/api/chats/${id}/metadata`, { data: { automaticSummaryEnabled: true } });
        expect(updated.ok()).toBeTruthy();
      }
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

      let surface = await openControlsSurface();
      const semanticSwitch = surface.getByRole("checkbox", { name: scenario.switchLabel });
      const recent = surface.getByRole("slider", { name: scenario.recentLabel, exact: true });
      const older = surface.getByRole("slider", { name: scenario.olderLabel, exact: true });
      const threshold = surface.getByRole("slider", { name: "Relevance threshold", exact: true });

      await expect(semanticSwitch).not.toBeChecked();
      await expect(recent).toHaveCount(0);
      await expect(older).toHaveCount(0);
      await expect(threshold).toHaveCount(0);

      if (scenario.mode === "conversation") {
        await surface
          .locator(`label[for="${await semanticSwitch.getAttribute("id")}"]`)
          .last()
          .click();
      } else {
        await semanticSwitch.click();
      }
      await expect.poll(async () => (await metadata()).semanticSummaryRetrievalEnabled).toBe(true);
      await expect(recent).toBeVisible();
      await expect(older).toBeVisible();
      await expect(threshold).toBeVisible();

      await expect(recent).toHaveValue("2");
      await expect(older).toHaveValue("3");
      await expect(threshold).toHaveValue("0.15");
      await expect(recent).toHaveAttribute("min", "0");
      await expect(recent).toHaveAttribute("max", "20");
      await expect(older).toHaveAttribute("min", "0");
      await expect(older).toHaveAttribute("max", "20");
      await expect(threshold).toHaveAttribute("min", "0");
      await expect(threshold).toHaveAttribute("max", "1");

      for (const [slider, value] of [
        [recent, String(savedValues.semanticSummaryRecentCount)],
        [older, String(savedValues.semanticSummaryOlderCount)],
        [threshold, String(savedValues.semanticSummaryMinSimilarity)],
      ] as const) {
        await slider.evaluate((element, nextValue) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          setter?.call(element, nextValue);
          element.dispatchEvent(new Event("input", { bubbles: true }));
          element.dispatchEvent(new Event("change", { bubbles: true }));
        }, value);
      }

      await expect
        .poll(async () => {
          const current = await metadata();
          return {
            semanticSummaryRecentCount: current.semanticSummaryRecentCount,
            semanticSummaryOlderCount: current.semanticSummaryOlderCount,
            semanticSummaryMinSimilarity: current.semanticSummaryMinSimilarity,
          };
        })
        .toMatchObject(savedValues);
      await page.screenshot({
        path: testInfo.outputPath(`semantic-recall-${scenario.mode}-enabled.png`),
        animations: "disabled",
      });

      await page.reload();
      surface = await openControlsSurface();
      const reloadedSwitch = surface.getByRole("checkbox", { name: scenario.switchLabel });
      const reloadedRecent = surface.getByRole("slider", { name: scenario.recentLabel, exact: true });
      const reloadedOlder = surface.getByRole("slider", { name: scenario.olderLabel, exact: true });
      const reloadedThreshold = surface.getByRole("slider", { name: "Relevance threshold", exact: true });
      await expect(reloadedSwitch).toBeChecked();
      await expect(reloadedRecent).toHaveValue(String(savedValues.semanticSummaryRecentCount));
      await expect(reloadedOlder).toHaveValue(String(savedValues.semanticSummaryOlderCount));
      await expect(reloadedThreshold).toHaveValue(String(savedValues.semanticSummaryMinSimilarity));

      if (scenario.mode === "conversation") {
        await surface
          .locator(`label[for="${await reloadedSwitch.getAttribute("id")}"]`)
          .last()
          .click();
      } else {
        await reloadedSwitch.click();
      }
      await expect.poll(async () => (await metadata()).semanticSummaryRetrievalEnabled).toBe(false);
      await expect(reloadedRecent).toHaveCount(0);
      await expect(reloadedOlder).toHaveCount(0);
      await expect(reloadedThreshold).toHaveCount(0);
    } finally {
      await request.delete(`/api/chats/${id}?force=true`).catch(() => undefined);
    }
  });
}

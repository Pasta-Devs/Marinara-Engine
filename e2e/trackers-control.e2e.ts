import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const agent = (id: string, name: string, category: "tracker" | "misc") => ({
  id,
  name,
  description: "Fixture",
  author: "Fixture",
  phase: "post_processing",
  enabledByDefault: false,
  category,
  modeAllowlist: ["roleplay"],
  defaultPromptTemplate: "Fixture",
});

// Roleplay's Agents section: Agent menus sit under Enable Agents, the tracker settings live in a collapsed
// Trackers Control card, and a chat saved with the old Manual Trackers switch shows every tracker as manual.
test("Trackers Control replaces Manual Trackers in Roleplay Agents", async ({ page, request }, info) => {
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Trackers Control", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  try {
    const legacy = await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: {
        enableAgents: true,
        activeAgentIds: ["world-state", "quest", "echo-chamber", "uninstalled-tracker"],
        manualTrackers: true,
      },
    });
    expect(legacy.ok(), await legacy.text()).toBeTruthy();
    const message = await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "The trackers are waiting." },
    });
    expect(message.ok()).toBeTruthy();
    await page.route("**/api/capability-packages/agents", (route) =>
      route.fulfill({
        json: [
          agent("world-state", "World State", "tracker"),
          agent("quest", "Quest Tracker", "tracker"),
          agent("inventory", "Inventory", "tracker"),
          agent("echo-chamber", "Echo Chamber", "misc"),
        ],
      }),
    );
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      trackerPanelEnabled: false,
      appAccentPulseMode: false,
      chatSettingsExpandedSections: { "roleplay-agents": true },
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    await page.goto("/");
    await expect(page.getByText("The trackers are waiting.", { exact: true })).toBeVisible();
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const section = page.locator('[data-chat-settings-section="roleplay-agents"]');
    const control = section.locator("[data-trackers-control]");
    await expect(control).toBeVisible();
    await expect(section.getByText("Manual Trackers", { exact: true })).toHaveCount(0);

    // Enable Agents → Agent menus → Trackers Control → Agent Suite.
    const order = await control.evaluate((card) =>
      Array.from(card.parentElement!.children, (child) =>
        child.matches("[data-agent-menus]")
          ? "Agent menus"
          : child.matches("[data-trackers-control]")
            ? "Trackers Control"
            : child.textContent!.startsWith("Enable Agents")
              ? "Enable Agents"
              : child.textContent!.startsWith("Agent Suite")
                ? "Agent Suite"
                : child.textContent!.slice(0, 40),
      ),
    );
    expect(order.slice(0, 4)).toEqual(["Enable Agents", "Agent menus", "Trackers Control", "Agent Suite"]);
    await expect(section.locator("[data-agent-menus]")).toContainText("Echo Chamber");

    // Collapsed by default; opened, it lists the four controls in order.
    const expand = control.getByRole("button", { name: "Expand Trackers Control", exact: true });
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expect(control.getByText("Attach chat summaries", { exact: true })).toHaveCount(0);
    await section.locator("[data-agent-menus]").evaluate((menus) => menus.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: info.outputPath("trackers-control-collapsed.png"), animations: "disabled" });
    await expand.click();
    await expect(control.getByRole("button", { name: "Collapse Trackers Control", exact: true })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const text = await control.innerText();
    const positions = [
      "Attach chat summaries",
      "Attach Lorebooks to Trackers",
      "Review Agent Outputs",
      "Individual tracker schedule",
    ].map((label) => text.indexOf(label));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    await expect(control.getByText("Manual Trackers", { exact: true })).toHaveCount(0);

    // The old switch shows every tracker as manual, and each one can still be changed.
    const worldState = control.getByRole("checkbox", { name: /^World State/u });
    const quest = control.getByRole("checkbox", { name: /^Quest Tracker/u });
    for (const toggle of [worldState, quest]) {
      await expect(toggle).toBeChecked();
      await expect(toggle).toBeEnabled();
    }
    await control.getByText("World State", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("trackers-control-legacy.png"), animations: "disabled" });
    await control.getByText("World State", { exact: true }).click();
    const saved = async () => {
      const stored = await (await request.get(`/api/chats/${chat.id}`)).json();
      const metadata = typeof stored.metadata === "string" ? JSON.parse(stored.metadata) : stored.metadata;
      return { manualTrackers: metadata.manualTrackers, manualTrackerAgentTypes: metadata.manualTrackerAgentTypes };
    };
    await expect
      .poll(saved)
      // The uninstalled id may be a tracker, so it stays manual; Echo Chamber is known not to be one.
      // Inventory is installed but not added yet: the old switch covered it, so it stays manual too.
      .toEqual({
        manualTrackers: false,
        manualTrackerAgentTypes: { "world-state": false, quest: true, inventory: true, "uninstalled-tracker": true },
      });
    await expect(worldState).not.toBeChecked();
    await expect(quest).toBeChecked();
    await expect(worldState).toBeEnabled();
    await expect(quest).toBeEnabled();
    await page.screenshot({ path: info.outputPath("trackers-control-individual.png"), animations: "disabled" });
  } finally {
    await request.delete(`/api/chats/${chat.id}`).catch(() => undefined);
  }
});

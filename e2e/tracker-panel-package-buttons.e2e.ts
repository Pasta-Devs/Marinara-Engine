// Issue #7280: with the Tracker Panel on, a tracker agent's own button (Quartermaster's dock button) showed
// nowhere, so its dock could not be opened. The button now sits in the panel's top bar on computers and phones.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const PACKAGE_ID = "dock-fixture";
test.use({ reducedMotion: "reduce" });

const installedPackage = {
  id: PACKAGE_ID,
  version: "1.0.0",
  status: "active",
  readiness: "ready",
  error: null,
  installedAt: "2026-01-01T00:00:00.000Z",
  manifest: {
    schemaVersion: 1,
    id: PACKAGE_ID,
    name: "Dock Fixture",
    version: "1.0.0",
    engine: { min: "2.0.0", maxExclusive: "4.0.0" },
    kind: ["agent"],
    entrypoints: { client: "client.js" },
    contributions: { slots: ["roleplay-tracker", "tracker-panel"] },
    permissions: ["ui"],
    files: [],
  },
};

// Like Quartermaster: the toolbar view is one button that opens the package's own dock.
const clientModule = `customElements.define("marinara-capability-${PACKAGE_ID}", class extends HTMLElement {
  connectedCallback() {
    const render = () => {
      if (this.getAttribute("view") !== "toolbar") {
        this.textContent = "Dock fixture section";
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "D";
      button.setAttribute("aria-label", "Open fixture dock");
      button.setAttribute("aria-pressed", String(window.fixtureDockOpen === true));
      button.className = String(this.capabilityProps?.toolbarButtonClass ?? "");
      button.addEventListener("click", () => {
        window.fixtureDockOpen = window.fixtureDockOpen !== true;
        button.setAttribute("aria-pressed", String(window.fixtureDockOpen));
      });
      this.replaceChildren(button);
    };
    this.addEventListener("marinara-capability-props", render);
    render();
  }
});`;

async function createChat(request: APIRequestContext) {
  const response = await request.post("/api/chats", {
    data: { name: "Tracker Panel package buttons", mode: "roleplay", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  const patched = await request.patch(`/api/chats/${chat.id}/metadata`, {
    data: { enableAgents: true, activeAgentIds: ["world-state", PACKAGE_ID] },
  });
  expect(patched.ok()).toBeTruthy();
  return chat;
}

async function openChat(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [installedPackage] }));
  await page.route(`**/api/capability-packages/${PACKAGE_ID}/client*`, (route) =>
    route.fulfill({ contentType: "application/javascript", body: clientModule }),
  );
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    chatSettingsMoveTipDismissed: true,
    appAccentPulseMode: false,
    trackerPanelEnabled: true,
    trackerPanelOpen: true,
    trackerPanelOpenByChatId: { [chatId]: true },
    trackerPanelSide: "right",
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version },
  );
  await page.goto("/");
  await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
}

test("a tracker agent's own button sits in the Tracker Panel's top bar", async ({ page, request }, info) => {
  const chat = await createChat(request);
  try {
    await openChat(page, chat.id);
    const panel = page.locator('[data-component="TrackerDataSidebar"]:visible');
    // Phones open the panel from its bubble; computers show it docked.
    if (info.project.name.includes("mobile")) {
      await page.locator('.mari-window-bubble[data-tracker-panel-toggle="bubble"]').click();
    }
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Dock fixture section", { exact: true })).toBeVisible();

    const header = panel.locator(".mari-tracker-panel-header");
    const dockButton = header.getByRole("button", { name: "Open fixture dock", exact: true });
    await expect(dockButton).toBeVisible();
    await expect(page.getByRole("button", { name: "Open fixture dock", exact: true })).toHaveCount(1);
    // It is sized like the header's own buttons, so the top bar keeps its height.
    const [buttonBox, closeBox] = await Promise.all([
      dockButton.boundingBox(),
      header.getByRole("button", { name: "Close tracker panel", exact: true }).boundingBox(),
    ]);
    expect(buttonBox).not.toBeNull();
    expect(closeBox).not.toBeNull();
    expect(buttonBox!.height).toBeLessThanOrEqual(closeBox!.height + 1);
    expect(Math.abs(buttonBox!.y + buttonBox!.height / 2 - (closeBox!.y + closeBox!.height / 2))).toBeLessThan(2);

    await dockButton.click();
    await expect(dockButton).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: info.outputPath("tracker-panel-package-button.png"), animations: "disabled" });
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

test("a narrow docked Tracker Panel gives the button its own row", async ({ page, request }, info) => {
  test.skip(!info.project.name.includes("desktop"), "The docked Tracker Panel is a computer layout.");
  const chat = await createChat(request);
  try {
    // At this width the panel shrinks to its minimum, where the top bar only fits the panel's own buttons.
    await page.setViewportSize({ width: 1024, height: 800 });
    await openChat(page, chat.id);
    const panel = page.locator('[data-component="TrackerDataSidebar"]:visible');
    const header = panel.locator(".mari-tracker-panel-header");
    const dockButton = header.getByRole("button", { name: "Open fixture dock", exact: true });
    await expect(dockButton).toBeVisible();
    const [panelBox, buttonBox, closeBox, settingsBox] = await Promise.all([
      panel.boundingBox(),
      dockButton.boundingBox(),
      header.getByRole("button", { name: "Close tracker panel", exact: true }).boundingBox(),
      header.getByRole("button", { name: "Open tracker settings", exact: true }).boundingBox(),
    ]);
    for (const box of [buttonBox!, closeBox!, settingsBox!]) {
      expect(box.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);
    }
    expect(buttonBox!.y).toBeGreaterThanOrEqual(closeBox!.y + closeBox!.height - 1);
    await dockButton.click();
    await expect(dockButton).toHaveAttribute("aria-pressed", "true");
  } finally {
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});

import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const callsManifest = {
  schemaVersion: 1,
  id: "conversation-calls",
  name: "Calls",
  version: "1.0.17",
  description: "Speech to Text card fixture.",
  engine: { min: "2.4.1", maxExclusive: "4.0.0" },
  kind: ["agent", "conversation-calls"],
  entrypoints: { client: "client.js" },
  files: [],
  permissions: ["network", "ui"],
  restartRequired: true,
};

// #7344: an edit made just before leaving Connections is saved once, and Connections shows it when opened again.
// On a phone, switching to the chat list unmounts the card at once, so it must not come back with older settings.
test("Speech to Text keeps an edit made just before leaving Connections", async ({ page }, testInfo) => {
  const saved = { enabled: false, baseUrl: "", apiKey: "", model: "", language: "" };
  const saves: Array<Record<string, unknown>> = [];
  await page.route("**/api/capability-packages/installed", (route) =>
    route.fulfill({
      json: [
        {
          id: callsManifest.id,
          version: callsManifest.version,
          manifest: callsManifest,
          installedAt: "2026-10-09T00:00:00Z",
          status: "active",
          error: null,
          readiness: "ready",
          readinessError: null,
          legacy: false,
        },
      ],
    }),
  );
  await page.route("**/api/capability-packages/conversation-calls/client*", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: 'customElements.define("marinara-capability-conversation-calls", class extends HTMLElement {});',
    }),
  );
  await page.route("**/api/speech-to-text/config", async (route) => {
    if (route.request().method() !== "PUT") return route.fulfill({ json: saved });
    const body = route.request().postDataJSON() as typeof saved;
    saves.push(body);
    Object.assign(saved, body, { apiKey: body.apiKey ? "••••••" : "" });
    return route.fulfill({ status: 204 });
  });
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
  await page.goto("/");

  const card = page.locator('[data-component="SpeechToTextCard"]');
  const serverUrl = card.getByPlaceholder("http://localhost:8000/v1");
  const leaveConnections = async () => {
    const name = testInfo.project.name.startsWith("mobile") ? "Chats" : "Close panel";
    await page.getByRole("button", { name, exact: true }).filter({ visible: true }).click();
    await expect(serverUrl).toBeHidden();
  };
  const openCard = async () => {
    await clickTopbarPanel(page, "connections");
    const toggle = card.locator("button[aria-expanded]");
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await expect(serverUrl).toBeVisible();
  };

  await openCard();
  await serverUrl.fill("http://localhost:9000/v1");
  // Leave before the autosave delay runs out.
  await leaveConnections();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0]).toMatchObject({ baseUrl: "http://localhost:9000/v1" });

  await openCard();
  await expect(serverUrl).toHaveValue("http://localhost:9000/v1");

  // Leaving again without another edit sends nothing new.
  await leaveConnections();
  await openCard();
  await expect(serverUrl).toHaveValue("http://localhost:9000/v1");
  await page.waitForTimeout(700);
  expect(saves).toHaveLength(1);
});

import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openDefaultsTile } from "./connections-panel.js";
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
// Variant D: Speech to text is not set up here, so its Defaults tile opens the card in the Add window; closing the
// window unmounts the card at once, so it must not come back with older settings.
test("Speech to Text keeps an edit made just before leaving Connections", async ({ page }, testInfo) => {
  const saved = { enabled: false, baseUrl: "", apiKey: "", model: "", language: "" };
  const saves: Array<Record<string, unknown>> = [];
  let heldSave: Promise<void> | null = null;
  let failHeldSave = false;
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
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
    const waitForRelease = heldSave;
    const shouldFail = failHeldSave;
    heldSave = null;
    failHeldSave = false;
    if (waitForRelease) await waitForRelease;
    if (shouldFail) return route.fulfill({ status: 500, json: { error: "Save failed fixture" } });
    Object.assign(saved, body, { apiKey: body.apiKey ? "••••••" : "" });
    return route.fulfill({ status: 204 });
  });
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
  await page.goto("/");

  const card = page.locator('[data-component="SpeechToTextCard"]');
  const serverUrl = card.getByPlaceholder("http://localhost:8000/v1");
  const leaveConnections = async () => {
    await page.keyboard.press("Escape");
    await expect(serverUrl).toBeHidden();
  };
  const openCard = async () => {
    await openDefaultsTile(page, "stt");
    const toggle = card.locator("button[aria-expanded]");
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await expect(serverUrl).toBeVisible();
  };

  await openCard();
  await expect(card.locator("div.bg-gradient-to-br").first()).toHaveClass(/from-sky-400 to-blue-500/);
  const ttsCard = page.locator('[data-component="TTSConfigCard"]');
  const expandTts = ttsCard.getByTitle("Expand", { exact: true });
  await expect(expandTts).toBeVisible();
  await expandTts.click();
  const surfaceStyle = (locator: typeof card) =>
    locator.evaluate((element) => {
      const icon = element.querySelector("svg.lucide-mic, svg.lucide-volume-2")!;
      const surface = getComputedStyle(element);
      const tile = getComputedStyle(icon.parentElement!);
      return {
        background: surface.backgroundImage,
        border: surface.borderColor,
        tile: tile.backgroundImage,
        icon: tile.color,
      };
    });
  const expectMatchingSurfaces = () =>
    expect
      .poll(
        async () => {
          const speechToText = await surfaceStyle(card);
          const textToSpeech = await surfaceStyle(ttsCard);
          return JSON.stringify(speechToText) === JSON.stringify(textToSpeech) ? null : { speechToText, textToSpeech };
        },
        { message: "Speech to Text uses the original Connections blue, matching Text to Speech" },
      )
      .toBeNull();
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate(async (theme) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      const settings = useUIStore.getState();
      settings.setAppAccentColor("#22c55e");
      settings.setAppAccentRgbMode(false);
      settings.setAppAccentPulseMode(false);
      settings.setTheme(theme);
    }, theme);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expectMatchingSurfaces();
    await card.screenshot({
      path: testInfo.outputPath(`speech-to-text-connections-${theme}.png`),
      animations: "disabled",
    });
  }
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

  // The debounce can fire while a slow phone is closing Connections. Keep that save in flight
  // through unmount; cleanup must wait for it, rather than send the same edit a second time.
  let releaseSave!: () => void;
  heldSave = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await serverUrl.fill("http://localhost:9001/v1");
  try {
    await expect.poll(() => saves.length).toBe(2);
    await leaveConnections();
  } finally {
    releaseSave();
  }
  await expect.poll(() => saved.baseUrl).toBe("http://localhost:9001/v1");
  await openCard();
  await expect(serverUrl).toHaveValue("http://localhost:9001/v1");
  await page.waitForTimeout(700);
  expect(saves).toHaveLength(2);

  // On a phone the card unmounts. If its in-flight save fails, cleanup must still retry it.
  if (testInfo.project.name.startsWith("mobile")) {
    heldSave = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    failHeldSave = true;
    await serverUrl.fill("http://localhost:9002/v1");
    try {
      await expect.poll(() => saves.length).toBe(3);
      await leaveConnections();
    } finally {
      releaseSave();
    }
    await expect.poll(() => saved.baseUrl).toBe("http://localhost:9002/v1");
    expect(saves.slice(2).map((save) => save.baseUrl)).toEqual([
      "http://localhost:9002/v1",
      "http://localhost:9002/v1",
    ]);
    await openCard();
    await expect(serverUrl).toHaveValue("http://localhost:9002/v1");
    await page.waitForTimeout(700);
    expect(saves).toHaveLength(4);
  }

  // A newer edit must survive the older request completing; neither can land out of order.
  const beforeNewerEdit = saves.length;
  heldSave = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  await serverUrl.fill("http://localhost:9003/v1");
  try {
    await expect.poll(() => saves.length).toBe(beforeNewerEdit + 1);
    await serverUrl.fill("http://localhost:9004/v1");
    await leaveConnections();
  } finally {
    releaseSave();
  }
  await expect.poll(() => saved.baseUrl).toBe("http://localhost:9004/v1");
  expect(saves.slice(beforeNewerEdit).map((save) => save.baseUrl)).toEqual([
    "http://localhost:9003/v1",
    "http://localhost:9004/v1",
  ]);
  await openCard();
  await expect(serverUrl).toHaveValue("http://localhost:9004/v1");
  await page.waitForTimeout(700);
  expect(saves).toHaveLength(beforeNewerEdit + 2);
});

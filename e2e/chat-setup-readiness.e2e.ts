import { expect, test } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { SIDECAR_DEFAULT_CONFIG } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Conversation setup explains missing requirements and Main sidecar satisfies model readiness", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/connections", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/connection-accounts", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/sidecar/status", (route) =>
    route.fulfill({
      json: {
        status: "stopped",
        config: { ...SIDECAR_DEFAULT_CONFIG, useAsMainDefault: false },
        modelDownloaded: false,
        modelDisplayName: null,
        modelSize: null,
        runtime: { installed: false, build: null, variant: null, backend: null },
        inferenceReady: false,
        logPath: null,
        platform: "linux",
        arch: "x64",
        curatedModels: [],
      },
    }),
  );
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation"],
    chatWizardDefaults: {},
  });
  const response = await request.post("/api/chats", {
    data: { name: "Setup readiness proof", mode: "conversation", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const { id } = (await response.json()) as { id: string };
  await page.addInitScript(
    ({ id, version }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { id, version },
  );
  try {
    await page.goto("/");
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenWizard(true);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const wizard = page.locator('[data-component="ChatSetupWizard"]');
    await expect(wizard).toBeVisible();
    for (let step = 0; step < 3; step += 1)
      await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(wizard.getByRole("button", { name: "Start Chatting", exact: true })).toBeDisabled();
    await expect(wizard.getByText("Complete the required setup before you start this chat.")).toBeVisible();
    const modelLink = wizard.getByRole("button", { name: "Set up a model", exact: true });
    await expect(modelLink).toBeVisible();
    await wizard.getByRole("button", { name: "Add a character", exact: true }).click();
    await expect(wizard.getByRole("heading", { name: "Persona & Characters", exact: true })).toBeVisible();
    await page.evaluate(async () => {
      const { useSidecarStore } = await import("/src/stores/sidecar.store.ts" as string);
      useSidecarStore.setState({ config: { ...useSidecarStore.getState().config, useAsMainDefault: true } });
    });
    await wizard.getByRole("button", { name: "Next", exact: true }).click();
    await expect(wizard.getByRole("button", { name: "Start Chatting", exact: true })).toBeDisabled();
    await expect(modelLink).toHaveCount(0);
    await expect(wizard.getByRole("button", { name: "Add a character", exact: true })).toBeVisible();
    mkdirSync(".tmp/chat-setup-readiness", { recursive: true });
    await page.screenshot({ path: ".tmp/chat-setup-readiness/missing-requirements-390.png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await request.delete(`/api/chats/${id}`);
  }
});

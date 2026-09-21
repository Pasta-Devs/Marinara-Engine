import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { AdvancedMemoryStatus } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

test("Numeric inputs keep selection when a saved value arrives before editing", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => "React" in globalThis && "ReactDOM" in globalThis);
  await page.evaluate(async () => {
    const { DraftNumberInput } = (await import("/src/components/ui/DraftNumberInput.tsx" as string)) as {
      DraftNumberInput: unknown;
    };
    const runtime = globalThis as typeof globalThis & {
      React: {
        Fragment: unknown;
        createElement: (component: unknown, props: Record<string, unknown> | null, ...children: unknown[]) => unknown;
        useState: (initial: number) => [number, (value: number) => void];
        useEffect: (effect: () => void, dependencies: unknown[]) => void;
      };
      ReactDOM: { createRoot: (mount: HTMLElement) => { render: (element: unknown) => void } };
    };
    const mount = document.createElement("div");
    mount.dataset.numericSelectionFixture = "true";
    mount.style.cssText = "position:fixed;top:100px;left:20px;z-index:10000;background:white;color:black";
    document.body.append(mount);
    function Fixture() {
      const [value, setValue] = runtime.React.useState(20000);
      const [committed, setCommitted] = runtime.React.useState(0);
      runtime.React.useEffect(() => {
        if (value !== 15999) return;
        // Start editing after effects schedule a saved-value echo, before deferred draft work can repaint.
        queueMicrotask(() => {
          const input = mount.querySelector("input");
          input?.select();
          input?.focus();
        });
      }, [value]);
      return runtime.React.createElement(
        runtime.React.Fragment,
        null,
        runtime.React.createElement(DraftNumberInput, {
          value,
          min: 64,
          max: 131072,
          onCommit: setCommitted,
          ariaLabel: "Summary budget fixture",
        }),
        runtime.React.createElement("button", { onClick: () => setValue(15999) }, "Deliver saved value"),
        runtime.React.createElement("output", null, String(committed)),
      );
    }
    runtime.ReactDOM.createRoot(mount).render(runtime.React.createElement(Fixture, null));
  });
  const fixture = page.locator("[data-numeric-selection-fixture]");
  const input = fixture.getByLabel("Summary budget fixture");
  await fixture.getByRole("button", { name: "Deliver saved value", exact: true }).click();
  await expect(input).toHaveValue("15999");
  await expect(input).toBeFocused();
  await page.keyboard.insertText("2048");
  await expect(input).toHaveValue("2048");
  await input.press("Enter");
  await expect(fixture.locator("output")).toHaveText("2048");
});

test("Roleplay wizard reuses automatic memory settings without downloaded agents", async ({ page, request }, info) => {
  const connectionResponse = await request.post("/api/connections", {
    data: { name: "Wizard memory proof", provider: "custom", model: "synthetic-model" },
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = (await connectionResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Automatic memory setup", mode: "roleplay", connectionId: connection.id },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const status = async () => {
    const response = await request.get(`/api/chats/${chat.id}/advanced-memory`);
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as AdvancedMemoryStatus;
  };
  let releaseContextSave = () => {};
  const contextSaveGate = new Promise<void>((resolve) => {
    releaseContextSave = resolve;
  });
  let acknowledgeContextSave = () => {};
  const contextSaved = new Promise<void>((resolve) => {
    acknowledgeContextSave = resolve;
  });
  let releaseMinimumSave = () => {};
  const minimumSaveGate = new Promise<void>((resolve) => {
    releaseMinimumSave = resolve;
  });
  let acknowledgeMinimumSave = () => {};
  const minimumSaved = new Promise<void>((resolve) => {
    acknowledgeMinimumSave = resolve;
  });
  let releaseLargerContextSave = () => {};
  const largerContextSaveGate = new Promise<void>((resolve) => {
    releaseLargerContextSave = resolve;
  });
  let acknowledgeLargerContextSave = () => {};
  const largerContextSaved = new Promise<void>((resolve) => {
    acknowledgeLargerContextSave = resolve;
  });
  let releaseStaleStatus = () => {};
  const staleStatusGate = new Promise<void>((resolve) => {
    releaseStaleStatus = resolve;
  });
  let staleStatusCaptured = false;
  let staleStatusAborted = false;
  const settingsPatches: Array<Record<string, unknown>> = [];
  try {
    expect(
      (await request.patch(`/api/chats/${chat.id}/metadata`, { data: { enableAgents: false } })).ok(),
    ).toBeTruthy();
    for (const endpoint of ["capability-packages/agents", "capability-packages/installed", "agents"]) {
      await page.route(`**/api/${endpoint}`, (route) => route.fulfill({ json: [] }));
    }
    await page.route(`**/api/chats/${chat.id}/advanced-memory/settings`, async (route) => {
      const patch = route.request().postDataJSON() as Record<string, unknown>;
      settingsPatches.push(patch);
      const response = await route.fetch();
      if (patch.maxContextTokens === 16000) {
        acknowledgeContextSave();
        await contextSaveGate;
      }
      if (patch.maxContextTokens === 32000) {
        acknowledgeLargerContextSave();
        await largerContextSaveGate;
      }
      if (patch.retrieveMinMessages === 20) {
        acknowledgeMinimumSave();
        await minimumSaveGate;
      }
      await route.fulfill({ response });
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      chatWizardDefaults: {},
    });
    await page.addInitScript(
      ({ chatId, version }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { chatId: chat.id, version },
    );
    await page.goto("/");
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenWizard(true);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const wizard = page.locator('[data-component="ChatSetupWizard"]');
    await expect(wizard).toBeVisible();
    const next = wizard.getByRole("button", { name: "Next", exact: true });
    await next.click();
    await expect(wizard.getByRole("heading", { name: "Pick a Preset", exact: true })).toBeVisible();
    await wizard.getByRole("combobox", { name: "Preset", exact: true }).click();
    await wizard
      .getByRole("listbox", { name: "Preset", exact: true })
      .getByRole("option", { name: "None", exact: true })
      .click();
    await next.click();
    await expect(wizard.getByRole("heading", { name: "Persona & Characters", exact: true })).toBeVisible();
    await next.click();
    await expect(wizard.getByRole("heading", { name: "Attach Lorebooks", exact: true })).toBeVisible();
    await next.click();
    await expect(wizard.getByRole("heading", { name: "Enable Agents", exact: true })).toBeVisible();
    await expect(wizard.locator('[data-component="ChatSetupWizard.AgentEmptyState"]')).toBeVisible();
    const agentsToggle = wizard.getByRole("switch", { name: /^Enable Agents/ });
    await expect(agentsToggle).toHaveAttribute("aria-checked", "false");
    const memory = wizard.locator('[data-component="AdvancedMemorySettings"]');
    const toggle = memory.getByRole("checkbox", { name: /Automatic context and memory handling \(alpha\)/ });
    await expect(toggle).not.toBeChecked();
    await expect(memory.getByLabel("Maximum allowed context before compression (tokens)")).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("memory-wizard-disabled.png"), animations: "disabled" });
    await memory.getByText("Automatic context and memory handling (alpha)", { exact: true }).click();
    await expect.poll(async () => (await status()).settings.enabled).toBe(true);
    const context = memory.getByLabel("Maximum allowed context before compression (tokens)");
    await expect(context).toBeEnabled();
    await page.route(`**/api/chats/${chat.id}/advanced-memory`, async (route) => {
      if (route.request().method() !== "GET" || staleStatusCaptured) {
        await route.continue();
        return;
      }
      const pendingRequest = route.request();
      page.on("requestfailed", (failedRequest) => {
        if (failedRequest === pendingRequest) staleStatusAborted = true;
      });
      const response = await route.fetch();
      staleStatusCaptured = true;
      await staleStatusGate;
      try {
        await route.fulfill({ response });
      } catch (error) {
        if (!staleStatusAborted) throw error;
      }
    });
    // Reopen the settings after their one-second freshness window. Ready archives
    // no longer poll; an explicit revisit still refreshes and can race with a save.
    await page.waitForTimeout(1100);
    await wizard.getByRole("button", { name: "Back", exact: true }).click();
    await expect(wizard.getByRole("heading", { name: "Attach Lorebooks", exact: true })).toBeVisible();
    await next.click();
    await expect.poll(() => staleStatusCaptured).toBe(true);
    await context.fill("16000");
    await context.press("Enter");
    await contextSaved;
    // A slow autosave must not disable or reject edits based on stale related limits.
    const summaryBudget = memory.getByLabel("Summary and recall budget (tokens)");
    await expect(summaryBudget).toBeEnabled();
    await summaryBudget.fill("20000");
    await summaryBudget.press("Enter");
    const maximum = memory.getByLabel("Maximum messages per excerpt", { exact: true });
    await expect(maximum).toBeEnabled();
    await maximum.fill("0");
    await maximum.press("Enter");
    await expect(maximum).toHaveValue("0");
    expect(settingsPatches.some((patch) => Object.hasOwn(patch, "retrieveMaxMessages"))).toBe(false);
    releaseContextSave();
    await expect.poll(() => staleStatusAborted).toBe(true);
    releaseStaleStatus();
    await expect.poll(async () => (await status()).settings.maxContextTokens).toBe(16000);
    await expect.poll(async () => (await status()).settings.summaryBudgetTokens).toBe(15999);
    await context.fill("32000");
    await context.press("Enter");
    await largerContextSaved;
    await summaryBudget.fill("20000");
    await summaryBudget.press("Enter");
    releaseLargerContextSave();
    await expect.poll(async () => (await status()).settings.summaryBudgetTokens).toBe(20000);
    await context.fill("16000");
    await context.press("Enter");
    await expect.poll(async () => (await status()).settings.maxContextTokens).toBe(16000);
    await summaryBudget.fill("2048");
    await summaryBudget.press("Enter");
    await expect.poll(async () => (await status()).settings.summaryBudgetTokens).toBe(2048);
    const sceneInterval = memory.getByLabel("Standalone scene check interval (messages)", { exact: true });
    await expect(sceneInterval).toHaveValue("5");
    await expect(sceneInterval).toBeEnabled();
    await sceneInterval.fill("8");
    await sceneInterval.press("Enter");
    await expect.poll(async () => (await status()).settings.sceneCheckInterval).toBe(8);
    await expect
      .poll(async () => {
        const { retrieveMinMessages, retrieveMaxMessages } = (await status()).settings;
        return [retrieveMinMessages, retrieveMaxMessages];
      })
      .toEqual([0, 0]);
    const minimum = memory.getByLabel("Minimum messages per excerpt", { exact: true });
    await expect(minimum).toHaveValue("0");
    await maximum.fill("10");
    await maximum.press("Enter");
    await expect.poll(async () => (await status()).settings.retrieveMaxMessages).toBe(10);
    await expect(toggle).toBeEnabled();
    await minimum.fill("3");
    await minimum.press("Enter");
    await expect.poll(async () => (await status()).settings.retrieveMinMessages).toBe(3);
    await expect(toggle).toBeEnabled();
    const pairedEditsStart = settingsPatches.length;
    await minimum.fill("20");
    await minimum.press("Enter");
    await minimumSaved;
    await expect(maximum).toBeEnabled();
    await maximum.fill("5");
    await maximum.press("Enter");
    expect(settingsPatches.slice(pairedEditsStart)).toEqual([{ retrieveMinMessages: 20, retrieveMaxMessages: 20 }]);
    releaseMinimumSave();
    await expect
      .poll(async () => {
        const settings = (await status()).settings;
        return [settings.retrieveMinMessages, settings.retrieveMaxMessages];
      })
      .toEqual([5, 5]);
    expect(settingsPatches.slice(pairedEditsStart)).toEqual([
      { retrieveMinMessages: 20, retrieveMaxMessages: 20 },
      { retrieveMaxMessages: 5, retrieveMinMessages: 5 },
    ]);
    await maximum.fill("0");
    await maximum.press("Enter");
    await expect.poll(async () => (await status()).settings.retrieveMaxMessages).toBe(0);
    await expect(minimum).toHaveValue("0");
    await expect(memory.getByText(/^Turning this on in an existing chat/)).toHaveCount(0);
    await memory.getByText("Moving context", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("memory-wizard-enabled.png"), animations: "disabled" });
    // Returning to the step re-reads the same saved form settings.
    await wizard.getByRole("button", { name: "Back", exact: true }).click();
    await expect(wizard.getByRole("heading", { name: "Attach Lorebooks", exact: true })).toBeVisible();
    await next.click();
    await expect(toggle).toBeChecked();
    await expect(context).toHaveValue("16000");
    await expect(sceneInterval).toHaveValue("8");
    await expect(maximum).toHaveValue("0");
    await expect(agentsToggle).toHaveAttribute("aria-checked", "false");
  } finally {
    releaseContextSave();
    releaseMinimumSave();
    releaseLargerContextSave();
    releaseStaleStatus();
    await request.delete(`/api/chats/${chat.id}?force=true`);
    await request.delete(`/api/connections/${connection.id}`);
  }
});

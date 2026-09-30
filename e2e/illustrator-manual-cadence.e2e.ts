import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Roleplay Gallery and slash illustrate work without enabling automatic agents", async ({
  page,
  request,
}, info) => {
  const previousUi = await (await request.get("/api/app-settings/ui")).json();
  await request.put("/api/app-settings/ui", { data: { value: "" } });
  const characterResponse = await request.post("/api/characters", { data: { data: { name: "Illustration fixture" } } });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = await characterResponse.json();
  const chatResponse = await request.post("/api/chats", {
    data: { name: "One-shot illustration", mode: "roleplay", characterIds: [character.id] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = await chatResponse.json();
  const activation = { enableAgents: false, activeAgentIds: [] };
  expect((await request.patch(`/api/chats/${chat.id}/metadata`, { data: activation })).ok()).toBeTruthy();
  const installed = {
    id: "illustrator",
    version: "1.0.0",
    status: "active",
    readiness: "ready",
    manifest: {
      schemaVersion: 1,
      id: "illustrator",
      name: "Illustrator",
      version: "1.0.0",
      engine: { min: "2.0.0", maxExclusive: "3.0.0" },
      kind: ["agent"],
      entrypoints: { agents: "agents.json" },
      permissions: ["agent-runtime"],
      files: [],
    },
  };
  let packageInstalled = true;
  const calls: Array<Record<string, unknown>> = [];
  await page.route("**/api/capability-packages/installed", (route) =>
    route.fulfill({ json: packageInstalled ? [installed] : [] }),
  );
  await page.route("**/api/generate/retry-agents", (route) => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "text/event-stream", body: 'data: {"type":"done","data":""}\n\n' });
  });
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    chatHelpSeenModes: ["roleplay"],
    trackerPanelEnabled: false,
    trackerPanelOpen: false,
    reviewImagePromptsBeforeSend: false,
    theme: info.project.name === "desktop-chromium" ? "light" : "dark",
  });
  await page.addInitScript(
    ({ id, appVersion }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", appVersion);
    },
    { id: chat.id, appVersion: version },
  );
  const openGallery = async () => {
    if (info.project.name.includes("mobile"))
      await page.getByRole("button", { name: "More options", exact: true }).click();
    await page.getByRole("button", { name: "Gallery", exact: true }).click();
    await expect(page.locator(".mari-chat-gallery-drawer")).toBeVisible();
  };
  try {
    await page.goto("/");
    await openGallery();
    await page.screenshot({ path: info.outputPath("manual-illustration-agents-disabled.png"), animations: "disabled" });
    const illustrate = page
      .locator(".mari-chat-gallery-drawer")
      .getByRole("button", { name: "Illustrate", exact: true });
    await expect(illustrate).toBeVisible();
    await expect(illustrate).toBeInViewport();
    await page.screenshot({ path: info.outputPath("manual-illustration-available.png"), animations: "disabled" });
    await illustrate.click();
    await expect.poll(() => calls.length).toBe(1);
    await expect(illustrate).toBeEnabled();
    await page.getByRole("button", { name: "Close gallery", exact: true }).click();
    const input = page.locator("textarea[data-chat-composer]");
    await input.fill("/illustrate ");
    await page.locator(".mari-chat-send-btn").click();
    await expect.poll(() => calls.length).toBe(2);
    for (const call of calls)
      expect(call).toMatchObject({
        chatId: chat.id,
        agentTypes: ["illustrator"],
        illustratorRetryTargets: ["illustration"],
      });
    const stored = await (await request.get(`/api/chats/${chat.id}`)).json();
    const metadata = typeof stored.metadata === "string" ? JSON.parse(stored.metadata) : stored.metadata;
    expect(metadata).toMatchObject(activation);
    packageInstalled = false;
    await page.reload();
    await openGallery();
    await expect(illustrate).toHaveCount(0);
    await page.getByRole("button", { name: "Close gallery", exact: true }).click();
    await input.fill("/illustrate");
    await expect(page.locator(".chat-input-container").getByRole("button", { name: /^\/illustrate\b/ })).toHaveCount(0);
    expect(calls).toHaveLength(2);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/characters/${character.id}`);
    await request.put("/api/app-settings/ui", { data: previousUi });
  }
});

test("Illustrator manual-only interval saves and survives reopening and chat setup", async ({
  page,
  request,
}, testInfo) => {
  const reset = await request.put("/api/app-settings/ui", { data: { value: "" } });
  expect(reset.ok()).toBeTruthy();
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      rightPanelOpen: false,
      sidebarOpen: false,
      chatHelpSeenModes: ["roleplay"],
    },
    "if-missing",
  );
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
  await page.route("**/api/capability-packages/agents", (route) =>
    route.fulfill({
      json: [
        {
          id: "illustrator",
          name: "Illustrator",
          description: "Manual-only cadence regression fixture.",
          author: "Pasta Devs",
          phase: "post_processing",
          execution: "host",
          enabledByDefault: false,
          category: "misc",
          modeAllowlist: ["roleplay"],
          runInterval: 5,
          defaultPromptTemplate: "Return an image prompt.",
        },
      ],
    }),
  );

  const agentResponse = await request.post("/api/agents", {
    data: {
      type: "illustrator",
      name: "Illustrator",
      description: "Manual-only cadence regression fixture.",
      phase: "post_processing",
      connectionId: null,
      promptTemplate: "Return an image prompt.",
      settings: { runInterval: 5 },
    },
  });
  expect(agentResponse.ok()).toBeTruthy();
  const agent = (await agentResponse.json()) as { id: string };
  const chatResponse = await request.post("/api/chats", {
    data: {
      name: "Illustrator manual-only cadence",
      mode: "roleplay",
      characterIds: [],
    },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const readSettings = async () => {
    const response = await request.get(`/api/agents/${agent.id}`);
    const row = (await response.json()) as { settings: string | Record<string, unknown> };
    return typeof row.settings === "string" ? JSON.parse(row.settings) : row.settings;
  };
  const openEditor = async () => {
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openAgentDetail("illustrator");
    });
    await expect(page.locator(".mari-editor-shell")).toBeVisible();
  };

  try {
    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), chat.id);
    await page.goto("/");
    await openEditor();
    const interval = page.locator('.mari-editor-shell input[type="number"][placeholder="5"][max="100"]');
    await expect(interval).toHaveValue("5");
    await expect(interval).toHaveAttribute("min", "0");
    await interval.fill("0");
    await expect(interval).toHaveValue("0");
    await expect(page.getByText(/^Set to 0 for manual-only generation/)).toBeVisible();
    await testInfo.attach("illustrator-manual-only-setup", { body: await page.screenshot(), contentType: "image/png" });
    await page.locator(".mari-editor-header .mari-editor-action--primary").click();
    await expect.poll(async () => (await readSettings()).runInterval).toBe(0);
    await page.reload();
    await openEditor();
    await expect(interval).toHaveValue("0");
    // A saved Illustrator can also be opened by its record ID, using the
    // existing custom-agent cadence field alongside its Illustrator settings.
    await page.evaluate(async (agentId) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openAgentDetail(agentId);
    }, agent.id);
    const recordInterval = page.locator('.mari-editor-shell .relative.w-28 > input[type="text"][inputmode="numeric"]');
    await expect(recordInterval).toHaveValue("0");
    await recordInterval.fill("0");
    await expect(recordInterval).toHaveValue("0");
    await recordInterval.fill("1");
    await recordInterval.press("ArrowDown");
    await expect(recordInterval).toHaveValue("0");
    await page.locator(".mari-editor-header .mari-editor-action--primary").click();
    await expect.poll(async () => (await readSettings()).runInterval).toBe(0);
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAgentDetail();
    });

    if (testInfo.project.name.includes("mobile")) {
      await page.getByRole("button", { name: "More options", exact: true }).click();
    }
    await page.getByRole("button", { name: "Chat Settings", exact: true }).click();
    const drawer = page.locator(".mari-chat-settings-drawer");
    const agents = drawer.locator('[role="button"][aria-expanded]').filter({ hasText: /^Agents/ });
    if ((await agents.getAttribute("aria-expanded")) !== "true") await agents.click();
    const enable = drawer.getByRole("checkbox", { name: /^Enable Agents/ });
    if (!(await enable.isChecked())) await enable.check();
    await drawer.getByRole("button", { name: /Misc Agents/ }).click();
    await drawer.getByRole("button").filter({ hasText: "Illustrator" }).last().click();
    const add = page.getByRole("dialog", { name: "Add Illustrator" });
    await expect(add).toBeVisible();
    const addInterval = add.locator('input[type="number"][max="100"]');
    await expect(addInterval).toHaveValue("0");
    await expect(addInterval).toHaveAttribute("min", "0");
    await addInterval.fill("1");
    await addInterval.fill("0");
    await expect(addInterval).toHaveValue("0");
    await testInfo.attach("illustrator-manual-only-chat-add", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await add.getByRole("button", { name: "Add", exact: true }).click();
    await expect(add).toBeHidden();
    await expect.poll(async () => (await readSettings()).runInterval).toBe(0);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/agents/${agent.id}`);
  }
});

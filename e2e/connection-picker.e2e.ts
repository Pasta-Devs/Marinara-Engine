import { expect, test } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const packageId = "picker-fixture";
const installed = {
  id: packageId,
  version: "1.0.0",
  status: "active",
  readiness: "ready",
  error: null,
  installedAt: "2026-01-01T00:00:00.000Z",
  manifest: {
    schemaVersion: 1,
    id: packageId,
    name: "Picker Fixture",
    version: "1.0.0",
    engine: { min: "2.0.0", maxExclusive: "4.0.0" },
    kind: ["agent"],
    entrypoints: { client: "client.js" },
    contributions: { slots: ["roleplay-tracker", "tracker-panel"] },
    permissions: ["ui"],
    files: [],
  },
};
const clientModule = `customElements.define("marinara-capability-${packageId}", class extends HTMLElement {
  connectedCallback() {
    const render = () => {
      if(this.getAttribute("view") !== "toolbar") { this.textContent="Picker fixture"; return; }
      window.pickerHost=this;
      const button=document.createElement("button"); button.type="button";
      button.textContent="Pick"; button.setAttribute("aria-label","Open shared picker fixture");
      button.className=String(this.capabilityProps?.toolbarButtonClass??"");
      button.onclick=()=>{window.pickerResult=undefined;this.capabilityProps.ui.pickConnection({kind:"image",includeDefault:false,title:"Image model"}).then(r=>window.pickerResult=r)};
      this.replaceChildren(button);
    };this.addEventListener("marinara-capability-props",render);render();
  }
});`;

test.use({ reducedMotion: "reduce" });
test("package and Engine share typed selection without changing chats or defaults", async ({ page, request }, info) => {
  test.setTimeout(120_000);
  await page.setViewportSize({
    width: Number(process.env.PICKER_SCREENSHOT_WIDTH) || (info.project.name === "desktop-chromium" ? 1440 : 390),
    height: 960,
  });
  const previous = (await (await request.get("/api/connections")).json()) as Array<{ id: string; isDefault: unknown }>;
  const created = await request.post("/api/connection-accounts", {
    data: {
      name: `Picker studio ${info.project.name}`,
      provider: "openai",
      baseUrl: "http://127.0.0.1:9/v1",
      apiKey: "picker-fixture-key",
    },
  });
  expect(created.ok()).toBeTruthy();
  const account = (await created.json()) as { account: { id: string }; connectionId: string };
  const ids = [account.connectionId];
  let chatId = "";
  try {
    await request.patch(`/api/connections/${account.connectionId}`, {
      data: { name: "Fixture chat", model: "vendor/chat" },
    });
    const imageResponse = await request.post("/api/connections", {
      data: {
        name: "Fixture image",
        provider: "image_generation",
        imageGenerationSource: "openai",
        baseUrl: "http://127.0.0.1:9/v1",
        apiKey: "ignored",
        accountId: account.account.id,
        model: "gpt-image-1",
      },
    });
    expect(imageResponse.ok()).toBeTruthy();
    const image = (await imageResponse.json()) as { id: string };
    ids.push(image.id);
    const chatResponse = await request.post("/api/chats", {
      data: { name: "Shared picker fixture", mode: "roleplay", characterIds: [] },
    });
    expect(chatResponse.ok()).toBeTruthy();
    chatId = (await chatResponse.json()).id;
    await request.patch(`/api/chats/${chatId}`, { data: { connectionId: account.connectionId } });
    await request.patch(`/api/chats/${chatId}/metadata`, {
      data: { enableAgents: true, activeAgentIds: ["world-state", packageId] },
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [installed] }));
    await page.route(`**/api/capability-packages/${packageId}/client*`, (route) =>
      route.fulfill({ contentType: "application/javascript", body: clientModule }),
    );
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      trackerPanelEnabled: true,
      trackerPanelOpen: true,
      trackerPanelOpenByChatId: { [chatId]: true },
      trackerPanelSide: "right",
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      chatSettingsMoveTipDismissed: true,
      chibiProfessorMariEnabled: false,
    });
    await page.addInitScript(
      ({ chatId, version }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { chatId, version },
    );
    const beforePicks = (await (await request.get("/api/connections")).json()) as typeof previous;
    await page.goto("/");
    await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible({ timeout: 30_000 });
    const panel = page.locator('[data-component="TrackerDataSidebar"]:visible');
    if (page.viewportSize()!.width < 768)
      await page.locator('.mari-window-bubble[data-tracker-panel-toggle="bubble"]').click();
    await expect(panel).toBeVisible();
    const trigger = page.getByRole("button", { name: "Open shared picker fixture" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Image model", exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Picker studio ${info.project.name}`);
    await expect(dialog.getByRole("button", { name: /Fixture chat/ })).toHaveCount(0);

    mkdirSync(".tmp/shared-picker/screenshots", { recursive: true });
    const width = page.viewportSize()!.width;
    for (const theme of ["dark", "light"]) {
      await page.evaluate((theme) => document.documentElement.setAttribute("data-theme", theme), theme);
      await page.screenshot({ path: `.tmp/shared-picker/screenshots/picker-${width}-${theme}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    await dialog.getByRole("searchbox").fill("gpt-image-1");
    await dialog.getByRole("button", { name: /Fixture image/ }).click();
    await expect
      .poll(() => page.evaluate(() => (window as any).pickerResult))
      .toEqual({ status: "selected", value: image.id });
    await expect(trigger).toBeFocused();
    // The API reports an explicit confirmation, even when the caller passed the current value.
    await page.evaluate((id) => {
      const w = window as any;
      w.pickerResult = undefined;
      w.pickerHost.capabilityProps.ui
        .pickConnection({ value: id, kind: "image", title: "Confirm model" })
        .then((r: unknown) => (w.pickerResult = r));
    }, image.id);
    await page
      .getByRole("dialog", { name: "Confirm model" })
      .getByRole("button", { name: /Fixture image/ })
      .click();
    await expect
      .poll(() => page.evaluate(() => (window as any).pickerResult))
      .toEqual({ status: "selected", value: image.id });
    // Default is a selected null; closing is a separate result.
    await page.evaluate(() => {
      const w = window as any;
      w.pickerResult = undefined;
      w.pickerHost.capabilityProps.ui
        .pickConnection({ kind: "chat", defaultLabel: "Inherit fixture default", title: "Default choice" })
        .then((r: unknown) => (w.pickerResult = r));
    });
    await page
      .getByRole("dialog", { name: "Default choice" })
      .getByRole("button", { name: "Inherit fixture default", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => (window as any).pickerResult))
      .toEqual({ status: "selected", value: null });
    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect.poll(() => page.evaluate(() => (window as any).pickerResult)).toEqual({ status: "cancelled" });
    await expect(trigger).toBeFocused();
    // Superseded calls settle, and unmounted package callbacks cannot open another window.
    await page.evaluate(() => {
      const w = window as any;
      w.first = undefined;
      w.second = undefined;
      w.retainedUi = w.pickerHost.capabilityProps.ui;
      w.retainedUi.pickConnection({ title: "First" }).then((r: unknown) => (w.first = r));
      w.retainedUi.pickConnection({ title: "Second" }).then((r: unknown) => (w.second = r));
    });
    await expect.poll(() => page.evaluate(() => (window as any).first)).toEqual({ status: "cancelled" });
    await expect(page.getByRole("dialog", { name: "Second" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect.poll(() => page.evaluate(() => (window as any).second)).toEqual({ status: "cancelled" });
    // A disabled account remains visible and cannot be newly selected.
    await request.patch(`/api/connection-accounts/${account.account.id}`, { data: { enabled: false } });
    await page.reload();
    if (page.viewportSize()!.width < 768)
      await page.locator('.mari-window-bubble[data-tracker-panel-toggle="bubble"]').click();
    await trigger.click();
    await expect(dialog.getByRole("button", { name: /Fixture image/ })).toBeDisabled();
    await page.keyboard.press("Escape");
    await request.patch(`/api/connection-accounts/${account.account.id}`, { data: { enabled: true } });
    const afterChat = await (await request.get(`/api/chats/${chatId}`)).json();
    expect(afterChat.connectionId).toBe(account.connectionId);
    const after = (await (await request.get("/api/connections")).json()) as Array<{ id: string; isDefault: unknown }>;
    const main = (rows: typeof previous) =>
      rows.filter((r) => r.isDefault === true || r.isDefault === "true").map((r) => r.id);
    expect(main(after)).toEqual(main(beforePicks));
    // Reject invalid values instead of silently presenting them as a default.
    expect(
      await page.evaluate(async () => {
        try {
          await (window as any).pickerHost.capabilityProps.ui.pickConnection({ value: 123 });
          return false;
        } catch (error) {
          return error instanceof TypeError;
        }
      }),
    ).toBe(true);
    await page.evaluate(() => {
      const w = window as any;
      w.retainedUi = w.pickerHost.capabilityProps.ui;
      w.pickerResult = undefined;
      w.retainedUi.pickConnection({ title: "Host lifetime" }).then((r: unknown) => (w.pickerResult = r));
    });
    await expect(page.getByRole("dialog", { name: "Host lifetime" })).toBeVisible();
    await page.evaluate(() =>
      (window as any).pickerHost.dispatchEvent(
        new CustomEvent("marinara-capability-runtime-error", { detail: { message: "Fixture stopped" } }),
      ),
    );
    await expect.poll(() => page.evaluate(() => (window as any).pickerResult)).toEqual({ status: "cancelled" });
    expect(await page.evaluate(() => (window as any).retainedUi.pickConnection())).toEqual({ status: "cancelled" });
  } finally {
    if (chatId) await request.delete(`/api/chats/${chatId}?force=true`);
    for (const id of ids) await request.delete(`/api/connections/${id}`);
    await request.delete(`/api/connection-accounts/${account.account.id}`);
  }
});

test("picker waits for account state and native controls keep their current value", async ({ page }, info) => {
  const { prepareViteFixtureDependencies } = await import("./vite-fixture-dependencies.js");
  let releaseAccounts!: () => void;
  const accountGate = new Promise<void>((resolve) => (releaseAccounts = resolve));
  let failAccounts = true;
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/connections", (route) =>
    route.fulfill({
      json: [
        {
          id: "state-fixture",
          name: "State fixture",
          provider: "openai",
          model: "gpt-fixture",
          accountId: "state-account",
        },
      ],
    }),
  );
  await page.route("**/api/connection-accounts", async (route) => {
    await accountGate;
    await route.fulfill(
      failAccounts
        ? { status: 503, json: { error: "Fixture account status unavailable" } }
        : { json: [{ id: "state-account", name: "State account", provider: "openai", baseUrl: "", state: "off" }] },
    );
  });
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chibiProfessorMariEnabled: false,
  });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What shall we cook tonight?", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await prepareViteFixtureDependencies(page);
    await page.evaluate(async () => {
      const { ConnectionSelect } = await import("/src/components/connections/ConnectionSelect.tsx" as string);
      const dependencyUrl = window.__viteFixtureDependencyUrl;
      const { default: React } = await import(dependencyUrl("react"));
      const { default: ReactDOM } = await import(dependencyUrl("react-dom_client"));
      const { QueryClient, QueryClientProvider } = await import(dependencyUrl("@tanstack_react-query"));
      const container = document.createElement("div");
      container.style.cssText =
        "position:fixed;z-index:9000;bottom:1rem;left:1rem;right:1rem;background:var(--card);padding:1rem";
      document.body.append(container);
      ReactDOM.createRoot(container).render(
        React.createElement(
          QueryClientProvider,
          { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          React.createElement(
            React.Fragment,
            null,
            React.createElement(ConnectionSelect, {
              variant: "native",
              value: null,
              onChange: () => {},
              "aria-label": "New native choice",
            }),
            React.createElement(ConnectionSelect, {
              variant: "native",
              value: "state-fixture",
              onChange: () => {},
              "aria-label": "Existing native choice",
            }),
            React.createElement(ConnectionSelect, {
              value: null,
              onChange: () => {},
              "aria-label": "Shared state picker",
            }),
          ),
        ),
      );
    });
    const native = page.locator('select[aria-label="New native choice"]');
    const current = page.locator('select[aria-label="Existing native choice"]');
    await expect(native.locator('option[value="state-fixture"]')).toBeDisabled();
    await expect(current).toHaveValue("state-fixture");
    await expect(current.locator('option[value="state-fixture"]')).toBeEnabled();
    await page.getByRole("button", { name: /^Shared state picker/ }).click();
    const dialog = page.getByRole("dialog", { name: "Choose a model", exact: true });
    await expect(dialog).toContainText("Loading models");
    await expect(dialog.locator('[data-picker-value="state-fixture"]')).toHaveCount(0);
    await page.screenshot({ path: `.tmp/shared-picker/screenshots/loading-${info.project.name}.png` });
    releaseAccounts();
    await expect(dialog.getByRole("alert")).toContainText("Couldn't load your models");
    await expect(dialog.locator('[data-picker-value="state-fixture"]')).toHaveCount(0);
    await expect(native.locator('option[value="state-fixture"]')).toBeDisabled();
    await page.screenshot({ path: `.tmp/shared-picker/screenshots/error-${info.project.name}.png` });
    failAccounts = false;
    await dialog.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(dialog.locator('[data-picker-value="state-fixture"]')).toBeDisabled();
    await expect(dialog).toContainText("State account");
    await expect(current).toHaveValue("state-fixture");
  } finally {
    releaseAccounts();
  }
});

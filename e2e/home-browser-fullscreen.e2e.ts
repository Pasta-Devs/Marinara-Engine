import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const appVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

// Exercise the host contract without depending on a separately published package artifact.
const fixtureClient = (id: string) => `
customElements.define('marinara-capability-${id}', class extends HTMLElement {
  connectedCallback() {
    const root = this.attachShadow({mode:'open'});
    root.innerHTML = '<button type="button"></button><textarea aria-label="Unfinished draft"></textarea><button data-close>Close package</button><button data-error>Fail package</button>';
    const sync = () => {
      const control = this.capabilityProps?.browserFullscreen;
      if (!control) return;
      const button = root.querySelector('button');
      button.textContent = control.active ? control.exitLabel : control.enterLabel;
      button.setAttribute('aria-pressed', String(control.active));
      button.onclick = () => control.setActive(!control.active);
      if (this.getAttribute('data-auto-requested') !== 'true' && this.localName.endsWith('fullscreen-auto')) {
        this.setAttribute('data-auto-requested', 'true');
        control.setActive(true);
      }
      root.querySelector('[data-close]').onclick = () => this.capabilityProps.onClose();
      root.querySelector('[data-error]').onclick = () => this.dispatchEvent(new CustomEvent('marinara-capability-runtime-error', {detail:{message:'Fixture failure'}}));
    };
    this.addEventListener('marinara-capability-props', sync);
    sync();
  }
});`;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((version) => {
    localStorage.removeItem("marinara-active-chat-id");
    localStorage.setItem("marinara:whats-new:seen-version", version);
  }, appVersion);
  await page.route("**/api/capability-packages/installed", (route) =>
    route.fulfill({
      json: ["fullscreen-one", "fullscreen-two", "fullscreen-auto"].map((id) => ({
        id,
        version: "1.0.0",
        status: "active",
        readiness: "ready",
        legacy: false,
        manifest: {
          schemaVersion: 1,
          id,
          name: id,
          version: "1.0.0",
          engine: { min: "2.5.1", maxExclusive: "4.0.0" },
          kind: ["agent"],
          entrypoints: { client: "client.js" },
          contributions: { slots: ["home-browser-tab"], homeBrowserTab: { label: id } },
          files: [],
          permissions: ["ui"],
          restartRequired: true,
        },
      })),
    }),
  );
  await page.route("**/api/capability-packages/fullscreen-*/client?*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: fixtureClient(new URL(route.request().url()).pathname.split("/")[3]!),
    }),
  );
});

test("package fullscreen fills Home while keeping the Engine topbar and unfinished form", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  await page.setViewportSize(mobile ? { width: 874, height: 402 } : { width: 2400, height: 1080 });
  await page.goto("/");
  await page.getByRole("tab", { name: "fullscreen-one" }).click();
  const surface = page.locator("marinara-capability-fullscreen-one");
  const chrome = page.locator(".mari-home-browser-chrome");
  const topbar = page.locator('[data-component="TopBar"]');
  const draft = surface.getByRole("textbox", { name: "Unfinished draft" });
  await draft.fill("Keep this unfinished world");
  // Preserve DOM identity as well as the draft value across the host prop update.
  await draft.evaluate((node) => {
    node.dataset.identity = "original";
  });
  for (const theme of ["dark", "light"] as const) {
    await page.evaluate(async (theme) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setTheme(theme);
    }, theme);
    const before = (await surface.boundingBox())!;
    await surface.getByRole("button", { name: "Enter fullscreen" }).click();
    await expect(chrome).toBeHidden();
    await expect(topbar).toBeVisible();
    await expect(surface.getByRole("button", { name: "Exit fullscreen" })).toHaveAttribute("aria-pressed", "true");
    await expect(draft).toHaveValue("Keep this unfinished world");
    await expect(draft).toHaveAttribute("data-identity", "original");
    const expanded = (await surface.boundingBox())!;
    const hub = (await page.locator('[data-component="HomeBrowserHub"]').boundingBox())!;
    expect(expanded.height).toBeGreaterThan(before.height);
    expect(Math.abs(expanded.width - hub.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(expanded.height - hub.height)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    await testInfo.attach(`package-fullscreen-${theme}.png`, {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    await surface.getByRole("button", { name: "Exit fullscreen" }).click();
    await expect(chrome).toBeVisible();
    await expect(draft).toHaveValue("Keep this unfinished world");
  }
});

test("leaving a package restores chrome and stale callbacks cannot fullscreen another tab", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "fullscreen-one" }).click();
  const one = page.locator("marinara-capability-fullscreen-one");
  await expect(one.getByRole("button", { name: "Enter fullscreen" })).toBeVisible();
  await one.evaluate((node) => {
    (window as any).oldFullscreenControl = (node as any).capabilityProps.browserFullscreen;
  });
  await one.getByRole("button", { name: "Enter fullscreen" }).click();
  await one.getByRole("button", { name: "Close package" }).click();
  await expect(page.locator(".mari-home-browser-chrome")).toBeVisible();
  await page.getByRole("tab", { name: "fullscreen-two" }).click();
  await page.evaluate(() => (window as any).oldFullscreenControl.setActive(true));
  await expect(page.locator(".mari-home-browser-chrome")).toBeVisible();
  const two = page.locator("marinara-capability-fullscreen-two");
  await two.getByRole("button", { name: "Enter fullscreen" }).click();
  await page.evaluate(() => (window as any).oldFullscreenControl.setActive(false));
  await expect(page.locator(".mari-home-browser-chrome")).toBeHidden();
  await two.getByRole("button", { name: "Fail package" }).click();
  await expect(page.locator(".mari-home-browser-chrome")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("fullscreen-two stopped");
});

test("a package can request fullscreen during its first prop delivery", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "fullscreen-auto", exact: true }).click();
  const surface = page.locator("marinara-capability-fullscreen-auto");
  await expect(surface).toHaveAttribute("data-auto-requested", "true");
  await expect(page.locator(".mari-home-browser-chrome")).toBeHidden();
  await expect(surface.getByRole("button", { name: "Exit fullscreen" })).toHaveAttribute("aria-pressed", "true");
  await surface.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect(page.locator(".mari-home-browser-chrome")).toBeVisible();
});

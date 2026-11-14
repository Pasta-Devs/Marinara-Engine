import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function openCleanHome(page: Page) {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: "" } : { success: true } }),
  );
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chibiProfessorMariEnabled: false,
  });
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
  await page.goto("/");
}

test("phone More keeps core navigation visible and retains extension actions", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"), "The overflow menu is specific to the phone-width layout.");
  await openCleanHome(page);

  const topbar = page.locator('[data-component="TopBar"]');
  const home = topbar.getByTitle("Home");
  const chats = topbar.getByTitle("Chats");
  const moreButton = page.getByRole("button", { name: "More", exact: true });
  await expect(home).toBeVisible();
  await expect(chats).toBeVisible();
  await expect(topbar.getByTitle("Characters")).toBeHidden();
  await expect(topbar.getByTitle("Settings")).toBeHidden();
  expect(await home.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(36);
  expect(await chats.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(36);

  await page.evaluate(async () => {
    const { registerPersonalExtensionContribution, setPersonalExtensionContributionDispatcher } = await import(
      "/src/lib/personal-extension-contributions.ts" as string
    );
    const extension = {
      id: "accessibility-fixture",
      name: "Fixture Extension",
      contentHash: "accessibility-fixture-hash",
    };
    if (
      !registerPersonalExtensionContribution(extension, {
        id: "fixture-action",
        kind: "button",
        label: "Fixture action",
        icon: "sparkles",
      })
    ) {
      throw new Error("Could not register the synthetic extension action");
    }
    Object.assign(window, { __fixtureExtensionActivated: false });
    setPersonalExtensionContributionDispatcher(extension, () => {
      Object.assign(window, { __fixtureExtensionActivated: true });
      document.querySelector<HTMLButtonElement>("[data-extension-focus-fixture]")?.focus();
    });
  });

  await moreButton.click();
  const menu = page.getByRole("menu", { name: "More destinations" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Characters", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Settings", exact: true })).toBeVisible();
  const extensionAction = menu.getByRole("menuitem", { name: /Fixture action.*Fixture Extension/ });
  await expect(extensionAction).toBeVisible();
  expect(await extensionAction.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(
    44,
  );
  await extensionAction.click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { __fixtureExtensionActivated?: boolean }).__fixtureExtensionActivated),
    )
    .toBe(true);
  await expect(moreButton).toBeFocused();

  await page.evaluate(() => {
    const button = document.createElement("button");
    button.dataset.extensionFocusFixture = "";
    button.textContent = "Extension focus fixture";
    document.body.append(button);
  });
  await moreButton.click();
  await extensionAction.click();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator("[data-extension-focus-fixture]")).toBeFocused();
  await page.locator("[data-extension-focus-fixture]").evaluate((element) => element.remove());

  await moreButton.click();
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    const events: string[] = [];
    const testWindow = window as Window & { __moreNavigationFocusEvents?: string[] };
    testWindow.__moreNavigationFocusEvents = events;
    document.querySelector("[data-topbar-more]")?.addEventListener("focus", () => events.push("more-focus"));
    document
      .querySelector('[data-component="RightPanel"]')
      ?.addEventListener("focus", () => events.push("panel-focus"));
    let wasOpen = useUIStore.getState().rightPanelOpen;
    useUIStore.subscribe((state: { rightPanelOpen: boolean }) => {
      if (!wasOpen && state.rightPanelOpen) events.push("panel-open");
      wasOpen = state.rightPanelOpen;
    });
  });
  await page.evaluate(() => {
    (window as Window & { __moreNavigationFocusEvents?: string[] }).__moreNavigationFocusEvents?.splice(0);
  });
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  await expect(topbar.getByTitle("Settings")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as Window & { __moreNavigationFocusEvents?: string[] }).__moreNavigationFocusEvents?.includes(
          "panel-open",
        ),
      ),
    )
    .toBe(true);
  const focusOrder = await page.evaluate(
    () => (window as Window & { __moreNavigationFocusEvents?: string[] }).__moreNavigationFocusEvents ?? [],
  );
  expect(focusOrder.indexOf("more-focus")).toBeGreaterThanOrEqual(0);
  expect(focusOrder.indexOf("more-focus")).toBeLessThan(focusOrder.indexOf("panel-open"));
  const activeDestination = await page.evaluate(() => {
    const active = document.activeElement;
    return {
      more: active === document.querySelector("[data-topbar-more]"),
      panel: active === document.querySelector('[data-component="RightPanel"]'),
    };
  });
  expect(activeDestination.more || activeDestination.panel).toBe(true);
  await moreButton.click();
  await expect(page.getByRole("menuitem", { name: "Settings", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(home).toBeVisible();
  await expect(chats).toBeVisible();
});

test("stacked dialogs keep focus in the top dialog and IME Escape does not dismiss it", async ({ page }, testInfo) => {
  await openCleanHome(page);
  await page.locator('[data-component="TopBar"]').getByTitle("Home").focus();

  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openModal("create-character");
  });
  const parent = page.getByRole("dialog", { name: "Create Character" });
  await expect(parent).toBeVisible();
  await page.evaluate(async () => {
    const { useDialogStore } = await import("/src/stores/dialog.store.ts" as string);
    useDialogStore.getState().openDialog({
      kind: "confirm",
      title: "Fixture confirmation",
      message: "Synthetic confirmation for focus testing.",
    });
  });

  const child = page.getByRole("dialog", { name: "Fixture confirmation" });
  await expect(child).toBeVisible();
  // The main action comes first and a phone sheet has no Close beside Cancel, so the first control is Close on a
  // computer and Confirm on a phone, and Cancel is the last one.
  const confirm = child.getByRole("button", { name: "Confirm", exact: true });
  const cancel = child.getByRole("button", { name: "Cancel", exact: true });
  const first = testInfo.project.name.includes("mobile") ? confirm : child.getByRole("button", { name: /Close/ });
  await first.focus();
  await page.evaluate(() => {
    Object.assign(window, { __fixtureFocusOwners: [] as Array<string | null> });
    document.addEventListener("focusin", (event) => {
      const owner =
        (event.target as HTMLElement).closest('[data-component="Modal"]')?.getAttribute("aria-label") ?? null;
      (window as unknown as Window & { __fixtureFocusOwners: Array<string | null> }).__fixtureFocusOwners.push(owner);
    });
  });
  await first.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  const focusOwners = await page.evaluate(
    () => (window as unknown as Window & { __fixtureFocusOwners: Array<string | null> }).__fixtureFocusOwners,
  );
  expect(focusOwners).not.toContain("Create Character");

  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().closeModal();
  });
  await expect(parent).not.toBeVisible();
  await expect(child).toBeVisible();
  await expect(cancel).toBeFocused();

  await page.evaluate(() => {
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    Object.defineProperty(event, "isComposing", { value: true });
    document.dispatchEvent(event);
  });
  await expect(child).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(child).not.toBeVisible();
});

test("phone More allows Tab and Shift+Tab to continue past the trigger", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile-"), "Phone menu only.");
  await openCleanHome(page);
  const more = page.getByRole("button", { name: "More", exact: true });
  const menu = page.getByRole("menu", { name: "More destinations" });
  await more.evaluate((trigger) => {
    for (const [position, name] of [
      ["beforebegin", "before"],
      ["afterend", "after"],
    ] as const) {
      const button = document.createElement("button");
      button.textContent = name;
      button.dataset.tabFixture = name;
      trigger.insertAdjacentElement(position, button);
    }
  });
  for (const backwards of [false, true]) {
    const key = `${testInfo.project.name === "mobile-webkit" ? "Alt+" : ""}${backwards ? "Shift+" : ""}Tab`;
    const destination = page.locator(`[data-tab-fixture="${backwards ? "before" : "after"}"]`);
    await more.focus();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem").last()).toBeFocused();
    await page.keyboard.press(key);
    await expect(menu).not.toBeVisible();
    await expect(destination).toBeFocused();
  }
});

// An iPhone Home Screen app fills the screen while its keyboard is closed, whatever iOS leaves behind: a visual
// viewport a status bar short, a stale offsetTop, or a page the keyboard left scrolled. Seen on a real iPhone as a grey
// band under the app until it was restarted. An open keyboard, or a focused field over a shortcut bar shorter than the
// keyboard threshold, still fits the app to the visible area.
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

/** A Home Screen app (navigator.standalone) whose visual viewport the test sets. Call before the page loads. */
async function installHomeScreenViewport(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "standalone", { configurable: true, get: () => true });
    const state = { height: 0, offsetTop: 0 };
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { get: () => state.height || innerHeight },
      width: { get: () => innerWidth },
      offsetTop: { get: () => state.offsetTop },
      pageTop: { get: () => state.offsetTop },
      offsetLeft: { get: () => 0 },
      pageLeft: { get: () => 0 },
      scale: { get: () => 1 },
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.assign(window, {
      __setViewport(height: number, offsetTop: number) {
        state.height = height;
        state.offsetTop = offsetTop;
        viewport.dispatchEvent(new Event("resize"));
      },
    });
  });
}

/** Sets the visual viewport, then waits for AppShell, which samples it in the next animation frame. */
const setViewport = (page: Page, height: number, offsetTop = 0) =>
  page.evaluate(
    async ([h, top]) => {
      (window as typeof window & { __setViewport: (h: number, top: number) => void }).__setViewport(h, top);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    },
    [height, offsetTop] as const,
  );

/** The app root's top and bottom against the layout viewport, and the page's scroll. */
const app = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector(".mari-app")!.getBoundingClientRect();
    return { top: Math.round(box.top), bottom: Math.round(box.bottom), innerHeight, scrollY: Math.round(scrollY) };
  });

test("an iPhone Home Screen app fills the screen while its keyboard is closed", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-webkit", "iPhone WebKit only");
  await isolateSyncedUISettings(page);
  await installHomeScreenViewport(page);
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-mari-ios-webkit", "");
  const full = await app(page);
  expect(full.top).toBe(0);
  expect(full.bottom).toBe(full.innerHeight);

  // iOS reports a visual viewport a status bar (59 pt) short with the keyboard closed: the app still ends at the
  // bottom. Before the fix it ended 59 pt early, the page backing showing below.
  await setViewport(page, full.innerHeight - 59);
  expect(await app(page)).toMatchObject({ top: 0, bottom: full.innerHeight });
  await expect(page.locator("html")).not.toHaveAttribute("data-mari-software-keyboard-open", "");

  // A stale offsetTop (WebKit 297779) with the shortfall: neither shifts nor shortens the app.
  await setViewport(page, full.innerHeight - 24, 24);
  expect(await app(page)).toMatchObject({ top: 0, bottom: full.innerHeight });

  // The keyboard left the page scrolled: it is scrolled back. The body clips its overflow, so the page is made
  // scrollable from <html>, which a script may scroll while overflow is hidden, as iOS does for its keyboard.
  await page.evaluate(() => {
    const tall = Object.assign(document.createElement("div"), { id: "leftover-scroll" });
    tall.style.height = "3000px";
    document.documentElement.append(tall);
    scrollTo(0, 200);
  });
  expect((await app(page)).scrollY).toBeGreaterThan(0);
  await setViewport(page, full.innerHeight);
  expect((await app(page)).scrollY).toBe(0);
  await page.evaluate(() => document.getElementById("leftover-scroll")?.remove());

  // An open keyboard still fits the app to the visible area, as before.
  const keyboardTop = Math.round(full.innerHeight * 0.55);
  await setViewport(page, keyboardTop);
  await expect(page.locator("html")).toHaveAttribute("data-mari-software-keyboard-open", "");
  expect((await app(page)).bottom).toBe(keyboardTop);

  // Closing it gives the whole screen back.
  await setViewport(page, full.innerHeight);
  await expect(page.locator("html")).not.toHaveAttribute("data-mari-software-keyboard-open", "");
  expect(await app(page)).toMatchObject({ top: 0, bottom: full.innerHeight });

  // A focused field keeps the fit even under the keyboard threshold: an iPad's hardware-keyboard shortcut bar.
  await page.evaluate(() => {
    const field = Object.assign(document.createElement("textarea"), { id: "shortcut-bar-field" });
    document.querySelector(".mari-app")!.append(field);
    field.focus();
  });
  await setViewport(page, full.innerHeight - 55);
  expect((await app(page)).bottom).toBe(full.innerHeight - 55);
  // Leaving the field (the bar goes) gives the screen back, even if iOS still reports the bar's height.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await setViewport(page, full.innerHeight - 55);
  expect(await app(page)).toMatchObject({ top: 0, bottom: full.innerHeight });
});

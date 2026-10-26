import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Lorebook, LorebookEntry } from "../packages/shared/src/types/lorebook.js";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const libraryUrl = /\/api\/lorebooks$/;
const entriesUrl = /\/api\/lorebooks\/([^/]+)\/entries$/;
const sample = "LANtern orchids scatter moon42 river bridge";
const regionName = "Other lorebook matches";

async function fixture(request: APIRequestContext, suffix: string) {
  const books: Lorebook[] = [];
  const cleanup = async () => {
    for (const book of books) await request.delete(`/api/lorebooks/${book.id}`);
  };
  const post = async <T>(path: string, data: Record<string, unknown>): Promise<T> => {
    const response = await request.post(path, { data });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  try {
    for (const [name, options] of [
      ["Current archive", {}],
      ["Copper archive", {}],
      ["Quiet archive", { enabled: false }],
      ["Hidden archive", { hiddenFromLibrary: true }],
    ] as const)
      books.push(await post<Lorebook>("/api/lorebooks", { name: `${name} ${suffix}`, ...options }));
    const [current, copper, quiet, hidden] = books as [Lorebook, Lorebook, Lorebook, Lorebook];
    const add = (book: Lorebook, name: string, keys: string[], options: Partial<LorebookEntry> = {}) =>
      post<LorebookEntry>(`/api/lorebooks/${book.id}/entries`, {
        name,
        content: "Synthetic keyword proof.",
        keys,
        ...options,
      });
    const local = await add(current, "Local lantern", ["lantern"]);
    const copperEntries: LorebookEntry[] = [];
    for (const [name, keys, options] of [
      ["Case-sensitive", ["ORCHID"], { caseSensitive: true }],
      ["Case-insensitive", ["ORCHID"], {}],
      ["Whole word", ["cat"], { matchWholeWords: true }],
      ["Regex", ["\\bmoon\\d+\\b"], { useRegex: true }],
      ["Selective", ["lantern"], { selective: true, secondaryKeys: ["river", "bridge"], selectiveLogic: "and_all" }],
      ["Without storm", ["lantern"], { selective: true, secondaryKeys: ["storm"], selectiveLogic: "not" }],
      ["Disabled", ["lantern"], { enabled: false }],
      ["Constant", [], { constant: true }],
      ["Disabled constant", [], { constant: true, enabled: false }],
    ] as Array<[string, string[], Partial<LorebookEntry>]>)
      copperEntries.push(await add(copper, name, keys, options));
    const other = await add(quiet, "Other source", ["lantern", "ember"]);
    await add(hidden, "Hidden match", ["lantern"]);
    return { books, current, copper, quiet, hidden, local, copperEntries, other, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function open(page: Page, book: Lorebook, theme: "dark" | "light") {
  await isolateSyncedUISettings(page);
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  await page.goto("/");
  await clickTopbarPanel(page, "lorebooks");
  await page.getByPlaceholder("Search lorebooks", { exact: true }).fill(book.name);
  await page.getByText(book.name, { exact: true }).click();
  const keyword = page.getByRole("button", { name: /^Keyword test(?:\s|$)/ });
  await expect(keyword).toBeVisible();
  const text = page.getByPlaceholder("Paste a paragraph or sample messages here…", { exact: true });
  return {
    keyword,
    text,
    scope: page.getByRole("checkbox", { name: /^Include other lorebooks(?:\s|$)/ }),
    region: page.getByRole("region", { name: regionName, exact: true }),
    toggle: () => page.getByText("Include other lorebooks", { exact: true }).click(),
  };
}

function trackEntries(page: Page) {
  const ids: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    const match = url.pathname.match(entriesUrl);
    if (request.method() === "GET" && match) {
      expect(url.search).toBe("");
      ids.push(match[1]!);
    }
  });
  return ids;
}

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return { promise, release };
}

for (const theme of ["dark", "light"] as const) {
  test(`foreign keyword matches are opt-in and preserve matching rules · ${theme}`, async ({ page, request }, info) => {
    const f = await fixture(request, `${info.project.name}-${theme}-${Date.now()}`);
    try {
      // Only the discovery response is scoped to our real API-created books, so parallel cases cannot interfere.
      await page.route(libraryUrl, (route) => route.fulfill({ json: f.books }));
      const calls = trackEntries(page);
      const ui = await open(page, f.current, theme);
      expect(calls.filter((id) => id !== f.current.id)).toEqual([]);
      await ui.keyword.click();
      await expect(ui.scope).not.toBeChecked();
      await ui.toggle();
      await expect(ui.scope).toBeChecked();
      await expect(ui.region).toHaveCount(0);
      expect(calls.filter((id) => id !== f.current.id)).toEqual([]);
      await ui.toggle();
      await ui.text.fill(sample);
      await expect(ui.keyword).toContainText("1 match");
      expect(calls.filter((id) => id !== f.current.id)).toEqual([]);
      const currentCalls = calls.filter((id) => id === f.current.id).length;
      await ui.toggle();
      const titles = ui.region.locator("li > p:first-child");
      for (const [text, expected] of [
        [sample, ["Case-insensitive", "Regex", "Selective", "Without storm", "Constant", "Other source"]],
        [
          "ORCHID cat lantern river bridge storm moon42",
          ["Case-sensitive", "Case-insensitive", "Whole word", "Regex", "Selective", "Constant", "Other source"],
        ],
        ["lantern river", ["Without storm", "Constant", "Other source"]],
      ] as Array<[string, string[]]>) {
        await ui.text.fill(text);
        await expect.poll(async () => (await titles.allTextContents()).sort()).toEqual([...expected].sort());
        await expect(ui.region).toHaveAttribute("aria-busy", "false");
        if (expected.includes("Whole word") && info.project.name.includes("desktop")) {
          const list = ui.region.getByRole("list");
          expect(await list.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);
          await list.focus();
          await expect(list).toBeFocused();
          await list.press("End");
          await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
        }
      }
      expect([...new Set(calls.filter((id) => id !== f.current.id))].sort()).toEqual([f.copper.id, f.quiet.id].sort());
      expect(calls.filter((id) => id === f.current.id)).toHaveLength(currentCalls);
      const other = ui.region.getByRole("listitem").filter({ hasText: "Other source" });
      await expect(other.getByText(`Lorebook: ${f.quiet.name}`, { exact: true })).toBeVisible();
      await expect(other.getByText("Keys: lantern, ember", { exact: true })).toBeVisible();
      await expect(ui.region.getByRole("listitem").filter({ hasText: "Constant" })).toContainText("Always active");
      await ui.text.fill(sample);
      await expect(ui.region.getByRole("listitem").filter({ hasText: "Selective" })).toContainText(
        "Secondary keys: river, bridge",
      );
      await expect(ui.keyword).toContainText("1 match");
      const scan = page.waitForResponse(
        (response) => new URL(response.url()).pathname === `/api/lorebooks/${f.current.id}/test`,
      );
      await page.getByRole("button", { name: "Run scanner", exact: true }).click();
      const scanned = await scan;
      expect(scanned.ok()).toBe(true);
      expect(scanned.request().postDataJSON()).toEqual({ text: sample });
      expect((await scanned.json()).activated.map((entry: { entryId: string }) => entry.entryId)).toEqual([f.local.id]);
      await expect(titles).toHaveCount(6);
      await ui.region.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath(`other-lorebook-matches-${theme}.png`), animations: "disabled" });
      const completedCalls = calls.length;
      await page.getByRole("button", { name: "Clear keyword test", exact: true }).click();
      await expect(ui.region).toHaveCount(0);
      await ui.text.fill("   ");
      await expect(ui.region).toHaveCount(0);
      await ui.text.fill(sample);
      await expect(titles).toHaveCount(6);
      await ui.toggle();
      await expect(ui.region).toHaveCount(0);
      await expect(ui.keyword).toContainText("1 match");
      await ui.keyword.click();
      await expect(ui.text).toHaveCount(0);
      expect(calls).toHaveLength(completedCalls);
    } finally {
      await page.close();
      await f.cleanup();
    }
  });

  test(`foreign keyword loading, retry and late responses stay honest · ${theme}`, async ({ page, request }, info) => {
    const f = await fixture(request, `race-${info.project.name}-${theme}-${Date.now()}`);
    const library = gate();
    const retriedLibrary = gate();
    const entries = gate();
    let libraryWorks = false;
    let entriesWork = false;
    try {
      // Controlled transport failures/delays exercise the real editor and query lifecycle, not a mock matcher.
      await page.route(libraryUrl, async (route) => {
        await library.promise;
        if (libraryWorks) await retriedLibrary.promise;
        if (!page.isClosed())
          await route.fulfill(
            libraryWorks ? { json: f.books } : { status: 500, json: { error: "Synthetic list failure" } },
          );
      });
      await page.route(`**/api/lorebooks/${f.copper.id}/entries`, async (route) => {
        await entries.promise;
        if (!page.isClosed()) await route.fulfill({ json: f.copperEntries });
      });
      await page.route(`**/api/lorebooks/${f.quiet.id}/entries`, (route) =>
        route.fulfill(entriesWork ? { json: [f.other] } : { status: 500, json: { error: "Synthetic entry failure" } }),
      );
      const calls = trackEntries(page);
      const ui = await open(page, f.current, theme);
      await ui.keyword.click();
      await ui.toggle();
      await ui.text.fill("lantern");
      await expect(ui.region.getByRole("status")).toHaveText("Loading other lorebooks…");
      expect(calls.filter((id) => id !== f.current.id)).toEqual([]);
      library.release();
      await expect(ui.region.getByRole("alert")).toContainText("Could not check every other lorebook.");
      await expect(ui.region.getByRole("status")).toHaveCount(0);
      expect(calls.filter((id) => id !== f.current.id)).toEqual([]);
      libraryWorks = true;
      const retry = page.waitForRequest((request) => libraryUrl.test(request.url()));
      await ui.region.getByRole("button", { name: "Retry other lorebooks", exact: true }).click();
      await retry;
      await ui.toggle();
      const loaded = page.waitForResponse((response) => libraryUrl.test(response.url()) && response.ok());
      retriedLibrary.release();
      await loaded;
      await expect(ui.region).toHaveCount(0);
      await expect(ui.scope).not.toBeChecked();
      expect(calls.filter((id) => id !== f.current.id)).toEqual([]);
      await ui.toggle();
      await expect.poll(() => calls.filter((id) => id === f.copper.id).length).toBeGreaterThan(0);
      await expect.poll(() => calls.filter((id) => id === f.quiet.id).length).toBeGreaterThan(0);
      await expect(ui.region).toHaveAttribute("aria-busy", "true");
      await ui.text.fill("ORCHID cat moon42");
      entries.release();
      await expect(ui.region.getByRole("alert")).toContainText("Could not check every other lorebook.");
      await expect(ui.region.getByRole("status")).toHaveCount(0);
      entriesWork = true;
      await ui.region.getByRole("button", { name: "Retry other lorebooks", exact: true }).click();
      await expect
        .poll(async () => (await ui.region.locator("li > p:first-child").allTextContents()).sort())
        .toEqual(["Case-insensitive", "Case-sensitive", "Constant", "Regex", "Whole word"].sort());
      await expect(ui.region).toHaveAttribute("aria-busy", "false");
      await expect(ui.region.getByRole("alert")).toHaveCount(0);
      await expect(ui.region.getByText("Other source", { exact: true })).toHaveCount(0);
    } finally {
      library.release();
      retriedLibrary.release();
      entries.release();
      await page.close();
      await f.cleanup();
    }
  });
}

test("keyword preview discovers every visible book beyond the first100 (controlled catalog)", async ({
  page,
  request,
}, info) => {
  test.skip(!info.project.name.includes("desktop"), "One browser proves unpaginated catalog discovery.");
  const f = await fixture(request, `many-${Date.now()}`);
  const extra = Array.from({ length: 101 }, (_, index) => ({
    ...f.copper,
    id: `synthetic-foreign-${index}`,
    name: `Synthetic archive ${index}`,
  }));
  try {
    await page.route(libraryUrl, (route) => route.fulfill({ json: [...f.books, ...extra] }));
    await page.route(entriesUrl, (route) => {
      const id = new URL(route.request().url()).pathname.match(entriesUrl)![1];
      return id === f.current.id ? route.fallback() : route.fulfill({ json: [] });
    });
    const calls = trackEntries(page);
    const ui = await open(page, f.current, "dark");
    await ui.keyword.click();
    await ui.toggle();
    await ui.text.fill("lantern");
    await expect(ui.region.getByRole("status")).toHaveText("No entries in other lorebooks match this text.");
    expect([...new Set(calls.filter((id) => id !== f.current.id))].sort()).toEqual(
      [f.copper.id, f.quiet.id, ...extra.map((book) => book.id)].sort(),
    );
    expect(calls).not.toContain(f.hidden.id);
  } finally {
    await page.close();
    await f.cleanup();
  }
});

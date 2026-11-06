import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";
import { clickTopbarPanel } from "./topbar-navigation.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("AND tags work in character and persona sidebars and libraries without extra controls", async ({
  page,
  request,
}, info) => {
  const prefix = `Tag search ${info.testId}`;
  const created: string[] = [];
  try {
    for (const kind of ["characters", "personas"] as const) {
      const endpoint = `/api/characters${kind === "personas" ? "/personas" : ""}`;
      for (const [suffix, tags] of [
        ["Both", ["male", "genshin", "Modern AU"]],
        ["One", ["male", "romance"]],
        ["Female", ["female", "genshin"]],
      ] as const) {
        const card = { name: `${prefix} ${kind} ${suffix}`, tags };
        const response = await request.post(endpoint, { data: kind === "characters" ? { data: card } : card });
        expect(response.ok(), await response.text()).toBeTruthy();
        created.push(`${endpoint}/${((await response.json()) as { id: string }).id}`);
      }
    }
    await isolateSyncedUISettings(page);
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
    await page.goto("/");
    for (const kind of ["characters", "personas"] as const) {
      if (kind === "personas") await page.goto("/");
      await clickTopbarPanel(page, kind);
      const name = `${prefix} ${kind} Both`;
      const search = page.getByPlaceholder(`Search ${kind}/tags`, { exact: true });
      await search.fill("male genshin");
      await expect(page.getByText(name, { exact: true })).toBeVisible();
      await expect(page.getByText(`${prefix} ${kind} One`, { exact: true })).toHaveCount(0);
      await expect(page.getByText(`${prefix} ${kind} Female`, { exact: true })).toHaveCount(0);
      await page.screenshot({ path: info.outputPath(`${kind}-sidebar-and.png`) });
      await search.fill("male genshin -tag:male");
      await expect(page.getByText(name, { exact: true })).toHaveCount(0);
      await search.fill(name);
      await expect(page.getByText(name, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Open Library", exact: true }).click();
      const library = page.locator('[data-component="CharacterLibraryView"]');
      const librarySearch = library.getByPlaceholder(`Search ${kind}`, { exact: true });
      await librarySearch.fill('male "Modern AU"');
      await expect(library.getByRole("button").filter({ hasText: name }).first()).toBeVisible();
      await expect(library.getByText(`${prefix} ${kind} One`, { exact: true })).toHaveCount(0);
      await librarySearch.fill("male,genshin");
      await expect(library.getByRole("button").filter({ hasText: name }).first()).toBeVisible();
      await librarySearch.fill("male，genshin");
      await expect(library.getByRole("button").filter({ hasText: name }).first()).toBeVisible();
      await librarySearch.fill("male ＂Modern AU＂");
      await expect(library.getByRole("button").filter({ hasText: name }).first()).toBeVisible();
      await page.screenshot({ path: info.outputPath(`${kind}-library-and.png`) });
    }
  } finally {
    for (const endpoint of created) await request.delete(endpoint);
  }
});

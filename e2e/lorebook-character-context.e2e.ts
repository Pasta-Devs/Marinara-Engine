import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("lorebook character context is opt-in and survives save, reload and duplication", async ({
  page,
  request,
}, info) => {
  const response = await request.post("/api/lorebooks", {
    data: { name: `Character context ${info.project.name}`, excludeFromVectorization: false },
  });
  expect(response.ok()).toBeTruthy();
  const book = await response.json();
  expect(book.vectorIncludeAssistant).toBe(false);
  let copyId: string | undefined;
  try {
    const theme = info.project.name === "desktop-chromium" ? "light" : "dark";
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.locator('[data-tour="panel-lorebooks"]').click();
    await page.getByText(book.name, { exact: true }).click();
    const option = page.getByRole("checkbox", { name: /^Include character context/ });
    await expect(option).not.toBeChecked();
    await page.getByText("Include character context", { exact: true }).click();
    await expect(option).toBeChecked();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => (await (await request.get(`/api/lorebooks/${book.id}`)).json()).vectorIncludeAssistant)
      .toBe(true);
    await page.getByText("Include character context", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("lorebook-character-context.png") });
    await page.reload();
    await page.locator('[data-tour="panel-lorebooks"]').click();
    await page.getByText(book.name, { exact: true }).click();
    await expect(option).toBeChecked();
    const duplicate = await page.evaluate(async (id) => {
      const { buildLorebookDuplicateInput } = await import("/src/lib/lorebook-duplicate.ts" as string);
      return buildLorebookDuplicateInput(await (await fetch(`/api/lorebooks/${id}`)).json());
    }, book.id);
    const copy = await request.post("/api/lorebooks", { data: duplicate });
    expect(copy.ok()).toBeTruthy();
    const copyRow = await copy.json();
    copyId = copyRow.id;
    expect(copyRow.vectorIncludeAssistant).toBe(true);
    await page.getByText("Include character context", { exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(async () => (await (await request.get(`/api/lorebooks/${book.id}`)).json()).vectorIncludeAssistant)
      .toBe(false);
  } finally {
    await page.close();
    if (copyId) await request.delete(`/api/lorebooks/${copyId}`);
    await request.delete(`/api/lorebooks/${book.id}`);
  }
});

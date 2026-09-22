import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Claude subscription cache duration saves and restores without enabling API prompt caching", async ({
  page,
  request,
}, info) => {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    theme: info.project.name === "desktop-chromium" ? "light" : "dark",
  });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  const created = await request.post("/api/connections", {
    data: {
      name: "Claude cache fixture",
      provider: "claude_subscription",
      model: "claude-opus-5",
      enableCaching: false,
    },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = await created.json();
  const open = async () => {
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openConnectionDetail(id);
    }, id);
    await expect(page.getByPlaceholder("Connection name")).toHaveValue("Claude cache fixture");
  };
  const toggle = page.getByRole("checkbox", { name: /^Extended token caching \(1 hour\)/u });
  try {
    await page.goto("/");
    await open();
    await expect(toggle).not.toBeChecked();
    for (const enabled of [true, false]) {
      await toggle.scrollIntoViewIfNeeded();
      await toggle.press("Space");
      await expect(toggle).toBeChecked({ checked: enabled });
      await page.getByRole("button", { name: "Export connection", exact: true }).click();
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("dialog").getByRole("button", { name: "Export", exact: true }).click();
      const download = await downloadPromise;
      const exported = JSON.parse(readFileSync((await download.path())!, "utf8"));
      expect(exported.connections[0].anthropicExtendedCacheTtl).toBe(enabled);
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect
        .poll(async () => {
          const value = await (await request.get(`/api/connections/${id}`)).json();
          return { extended: String(value.anthropicExtendedCacheTtl), caching: String(value.enableCaching) };
        })
        .toEqual({ extended: String(enabled), caching: "false" });
      await page.reload();
      await open();
      await expect(toggle).toBeChecked({ checked: enabled });
      if (enabled) {
        await toggle.scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath("subscription-extended-cache.png"), animations: "disabled" });
      }
    }
  } finally {
    await page.close();
    await request.delete(`/api/connections/${id}`);
  }
});

import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

test("name completion continues through spaces and accepts the complete name", async ({ page, request }, testInfo) => {
  const name = "dc simulator completion proof";
  const created = await request.post("/api/characters", { data: { data: { name } } });
  expect(created.ok()).toBe(true);
  const { id } = (await created.json()) as { id: string };
  try {
    await seedUIState(page, { hasCompletedOnboarding: true, omnibarAsideEnabled: false });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
    await page.goto("/");
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+k");
    const omnibar = page.locator('[data-component="GlobalOmnibar"]');
    const input = omnibar.getByRole("searchbox", { name: "Search Marinara" });
    const suffix = omnibar.locator('[data-component="InlineGhostText"] > span').first();
    await input.fill("DC");
    await expect(suffix).toHaveText(" simulator completion proof");
    await input.fill("DC ");
    await expect(suffix).toHaveText("simulator completion proof");
    await page.screenshot({ path: testInfo.outputPath("name-with-trailing-space.png") });
    await input.press("Tab");
    await expect(input).toHaveValue("DC simulator completion proof");
    await input.fill("dc sim");
    await expect(suffix).toHaveText("ulator completion proof");
  } finally {
    await request.delete(`/api/characters/${id}`);
  }
});

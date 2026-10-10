import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const shots = ".tmp/mari-window-height";

test("Professor Mari height slider keeps the old minimum and persists its choice", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const mobile = testInfo.project.name.includes("mobile");
  const diagnostics: string[] = [];
  page.on("pageerror", (error) => diagnostics.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.push(message.text());
  });
  page.on("requestfailed", (request) =>
    diagnostics.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`),
  );
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false }, "if-missing");
  if (!mobile) await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto("/");
  const openMari = async () => {
    await page
      .locator("main")
      .first()
      .click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+j");
    await expect(page.locator('[data-component="GlobalOmnibar.Mari"]')).toHaveAttribute("aria-hidden", "false");
  };
  await openMari();
  const panel = page.locator('[data-component="GlobalOmnibar.Panel"]');
  const expectedHeight = (rem: number) =>
    page.evaluate(
      (value) =>
        innerWidth < 640
          ? innerHeight
          : Math.min(
              value * parseFloat(getComputedStyle(document.documentElement).fontSize),
              innerHeight * (Math.min(88, (80 * value) / 44) / 100),
            ),
      rem,
    );
  const assertHeight = async (rem: number) => {
    const expected = await expectedHeight(rem);
    await expect.poll(async () => (await panel.boundingBox())?.height).toBeCloseTo(expected, 0);
  };
  await assertHeight(48);
  if (!mobile) {
    await page.setViewportSize({ width: 1440, height: 768 });
    await assertHeight(48);
    expect((await panel.boundingBox())!.height).toBeGreaterThan(768 * 0.8);
    await page.setViewportSize({ width: 1440, height: 1080 });
    await assertHeight(48);
  }
  await panel.getByRole("button", { name: "Search and Professor Mari settings", exact: true }).click();
  const slider = panel.getByRole("slider", { name: "Professor Mari window height" });
  await expect(slider).toHaveAttribute("min", "44");
  await expect(slider).toHaveValue("48");
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("44");
  await assertHeight(44);
  await page.keyboard.press("End");
  await expect(slider).toHaveValue("64");
  await assertHeight(64);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem("marinara-engine-ui") || "{}").state?.mariWindowHeightRem),
    )
    .toBe(64);
  await page.reload();
  await openMari();
  await assertHeight(64);
  await panel.getByRole("button", { name: "Search and Professor Mari settings", exact: true }).click();
  await expect(slider).toHaveValue("64");
  mkdirSync(shots, { recursive: true });
  await slider.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/${testInfo.project.name}-settings.png` });
  await page.keyboard.press("Escape");
  await expect(slider).not.toBeVisible();
  await page.screenshot({ path: `${shots}/${testInfo.project.name}-window.png` });
  if (!mobile) {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1080 });
      for (const visualTheme of ["default", "sillytavern"] as const) {
        for (const theme of ["dark", "light"] as const) {
          await page.evaluate(
            async ({ visualTheme, theme }) => {
              const modulePath = "/src/stores/ui.store.ts";
              const { useUIStore } = await import(modulePath);
              useUIStore.getState().setVisualTheme(visualTheme);
              useUIStore.getState().setTheme(theme);
            },
            { visualTheme, theme },
          );
          await assertHeight(64);
          await page.screenshot({ path: `${shots}/${width}-${visualTheme}-${theme}-window.png` });
          await panel.getByRole("button", { name: "Search and Professor Mari settings", exact: true }).click();
          await slider.scrollIntoViewIfNeeded();
          await page.screenshot({ path: `${shots}/${width}-${visualTheme}-${theme}-settings.png` });
          await page.keyboard.press("Escape");
          await expect(slider).not.toBeVisible();
        }
      }
    }
  }
  await testInfo.attach("browser-diagnostics", {
    body: diagnostics.join("\n") || "No console errors or failed requests.",
    contentType: "text/plain",
  });
});

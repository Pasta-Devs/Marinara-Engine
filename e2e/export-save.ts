import { test, type Download, type Page } from "@playwright/test";

/**
 * Start an export and return its download. On iPhone the share sheet would take the file, so this emulates
 * plain http on a LAN (no share sheet), where exports offer a Save file toast whose tap downloads (#7115).
 */
export async function downloadExport(page: Page, startExport: () => Promise<unknown>): Promise<Download> {
  const iphone = test.info().project.name === "mobile-webkit";
  if (iphone) {
    await page.evaluate(() => Object.defineProperty(navigator, "share", { configurable: true, value: undefined }));
  }
  const download = page.waitForEvent("download");
  await startExport();
  if (iphone) await page.getByRole("button", { name: "Save file", exact: true }).last().click();
  return download;
}

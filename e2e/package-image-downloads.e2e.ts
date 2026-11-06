import { expect, test, type Page } from "@playwright/test";
import { installPackageClient, preparePackagePage, waitForPackageClient } from "./host-package-fixture.js";
import { seedUIState } from "./ui-state-fixture.js";

const imageUrl = "/api/global-gallery/file/package-image-proof.png";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJRkAAAAASUVORK5CYII=",
  "base64",
);

async function openImagePackage(page: Page, prepared = false) {
  await preparePackagePage(page);
  await seedUIState(page, { hasCompletedOnboarding: true });
  await installPackageClient(
    page,
    "e2e-image-download-package",
    `
const service = globalThis.__MARINARA_HOST__.services.imageDownloads;
const button = document.createElement("button");
button.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:99999";
if (${prepared}) {
  if (!service.shouldUseIosImageShare()) throw new Error("iPhone policy was not used");
  const prepared = await service.prepareImageSave(${JSON.stringify(imageUrl)}, "prepared-background.png");
  button.id = "package-share-image";
  button.textContent = "Share prepared package image";
  button.onclick = () => {
    globalThis.__packageSaveCaller = new Error().stack;
    globalThis.__packageSaveTap = true;
    const save = service.savePreparedImageToDevice(prepared);
    globalThis.__packageSaveTap = false;
    void save.then(
      () => globalThis.__packageSaveResult = "settled",
      error => globalThis.__packageSaveResult = error.name,
    );
  };
} else {
  button.id = "package-save-image";
  button.textContent = "Save package image";
  button.onclick = () => {
    globalThis.__packageSaveCaller = new Error().stack;
    void service.downloadUrlToDevice(${JSON.stringify(imageUrl)}, "package-background.png");
  };
}
document.body.append(button);
`,
  );
  await page.route(`**${imageUrl}`, (route) => route.fulfill({ contentType: "image/png", body: png }));
  await page.goto("/");
  await waitForPackageClient(page);
}

test("package image saving retains the existing browser download and Android bridge", async ({ page }) => {
  await openImagePackage(page);
  const pendingDownload = page.waitForEvent("download");
  await page.locator("#package-save-image").click();
  expect((await pendingDownload).suggestedFilename()).toBe("package-background.png");
  expect(await page.evaluate(() => (window as any).__packageSaveCaller)).toContain(
    "/api/capability-packages/e2e-image-download-package/client",
  );

  await page.evaluate(() => {
    const target = window as any;
    target.__MARINARA_ANDROID_BRIDGE_TOKEN__ = "a".repeat(64);
    target.MarinaraAndroid = {
      saveFile: (...args: unknown[]) => {
        target.__packageAndroidSaved = args;
      },
    };
  });
  await page.locator("#package-save-image").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__packageAndroidSaved))
    .toEqual(["a".repeat(64), png.toString("base64"), "image/png", "package-background.png"]);
});

test("package prepared iPhone image sharing stays on the tap and never falls back after cancel or failure", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperties(navigator, {
      userAgent: {
        configurable: true,
        value:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      },
      platform: { configurable: true, value: "iPhone" },
      maxTouchPoints: { configurable: true, value: 5 },
      canShare: { configurable: true, value: (data: ShareData) => data.files?.length === 1 },
      share: {
        configurable: true,
        value: (data: ShareData) => {
          const target = window as any;
          target.__packageShared = {
            sameTap: target.__packageSaveTap === true,
            active: navigator.userActivation?.isActive,
            name: data.files?.[0]?.name,
            type: data.files?.[0]?.type,
            size: data.files?.[0]?.size,
          };
          return target.__packageShareError
            ? Promise.reject(new DOMException("Fixture share result", target.__packageShareError))
            : Promise.resolve();
        },
      },
    });
  });
  await openImagePackage(page, true);
  const downloads: string[] = [];
  page.on("download", (item) => downloads.push(item.suggestedFilename()));

  for (const error of [null, "AbortError", "NotAllowedError"]) {
    await page.evaluate((value) => {
      (window as any).__packageShareError = value;
      (window as any).__packageSaveResult = "pending";
    }, error);
    await page.locator("#package-share-image").click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__packageSaveResult))
      .toBe(error === "NotAllowedError" ? error : "settled");
    expect(await page.evaluate(() => (window as any).__packageShared)).toEqual({
      sameTap: true,
      active: true,
      name: "prepared-background.png",
      type: "image/png",
      size: png.length,
    });
    expect(downloads).toEqual([]);
    expect(await page.evaluate(() => (window as any).__packageSaveCaller)).toContain(
      "/api/capability-packages/e2e-image-download-package/client",
    );
  }
});

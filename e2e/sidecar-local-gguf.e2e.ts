import { test, expect } from "@playwright/test";
import { SIDECAR_DEFAULT_CONFIG } from "@marinara-engine/shared";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("local GGUF settings show runtime allocations and persist cache choices", async ({ page }, info) => {
  const config = { ...SIDECAR_DEFAULT_CONFIG, externalModelPath: "/models/existing.gguf" };
  let localPath = "";
  let fail = true;
  const status = () => ({
    status: "ready",
    config,
    modelDownloaded: true,
    modelDisplayName: "existing.gguf",
    modelSize: 1024 ** 3,
    runtime: { installed: true, build: "fixture", variant: "win-x64-cuda", backend: "llama_cpp" },
    inferenceReady: true,
    logPath: null,
    platform: "win32",
    arch: "x64",
    curatedModels: [],
    gpuMemory: { weightsBytes: 1024 ** 3, kvCacheBytes: 256 * 1024 ** 2, buffersBytes: 64 * 1024 ** 2 },
  });
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/sidecar/status", (route) => route.fulfill({ json: status() }));
  await page.route("**/api/sidecar/config", (route) => {
    Object.assign(config, route.request().postDataJSON());
    return route.fulfill({ json: { config } });
  });
  await page.route("**/api/sidecar/model/local", (route) => {
    localPath = route.request().postDataJSON().path;
    if (fail)
      return route.fulfill({
        status: 400,
        json: { error: "The selected file does not have a supported GGUF header." },
      });
    config.externalModelPath = localPath;
    return route.fulfill({ json: status() });
  });
  const theme = info.project.name === "desktop-chromium" ? "light" : "dark";
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await page.evaluate(async () => {
    const { useSidecarStore } = await import("/src/stores/sidecar.store.ts" as string);
    await useSidecarStore.getState().fetchStatus();
    useSidecarStore.getState().setShowDownloadModal(true);
  });
  const dialog = page.getByRole("dialog", { name: "Built-in model" });
  await dialog.getByRole("button", { name: /^Memory/ }).click();
  await expect(dialog.getByText("GPU allocations reported by llama.cpp", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Reported total", { exact: true })).toBeVisible();
  await expect(dialog.getByText("1.3 GB", { exact: true })).toBeVisible();
  await dialog.getByRole("combobox", { name: "KV cache type" }).selectOption("q4_0");
  await expect.poll(() => config.kvCacheType).toBe("q4_0");
  await page.screenshot({ path: info.outputPath("sidecar-memory.png") });
  await dialog.getByRole("button", { name: "Back" }).click();

  // The model is a local file, so Change model opens on the file tab.
  await dialog.getByRole("button", { name: "Change model" }).click();
  const input = dialog.getByRole("textbox", { name: "Existing GGUF file" });
  config.externalModelPath = "/models/loaded-later.gguf";
  await page.evaluate(async () => {
    const { useSidecarStore } = await import("/src/stores/sidecar.store.ts" as string);
    await useSidecarStore.getState().fetchStatus();
  });
  await expect(input).toHaveValue("/models/loaded-later.gguf");
  await input.fill("");
  await expect(dialog.getByRole("button", { name: "Use this file" })).toBeDisabled();
  await input.fill("/models/custom.gguf");
  await dialog.getByRole("button", { name: "Use this file" }).click();
  await expect(
    page.getByText("The selected file does not have a supported GGUF header.", { exact: true }),
  ).toBeVisible();
  // A failed file keeps the picker open for another try.
  fail = false;
  await dialog.getByRole("button", { name: "Use this file" }).click();
  await expect.poll(() => config.externalModelPath).toBe("/models/custom.gguf");
  expect(localPath).toBe("/models/custom.gguf");
  await expect(page.getByText("Local GGUF selected.", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Change model" })).toBeVisible();

  config.externalModelPath = "/models/updated-after-selection.gguf";
  await page.evaluate(async () => {
    const { useSidecarStore } = await import("/src/stores/sidecar.store.ts" as string);
    await useSidecarStore.getState().fetchStatus();
  });
  await dialog.getByRole("button", { name: "Change model" }).click();
  await expect(input).toHaveValue(config.externalModelPath);
  await page.screenshot({ path: info.outputPath("sidecar-local-file.png") });
});
